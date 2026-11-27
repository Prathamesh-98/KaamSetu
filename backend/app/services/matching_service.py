from typing import List, Dict, Any, Tuple, Optional
from app.models.models import WorkerProfile, Job, AvailabilityStatus, SalaryType
from app.services.distance_service import haversine_distance_km


def _to_daily_salary(amount: float, salary_type: SalaryType) -> Optional[float]:
    """Normalize hourly/daily/monthly wages onto a comparable daily baseline (8h/day, 26d/month)."""
    if salary_type == SalaryType.DAILY:
        return amount
    if salary_type == SalaryType.HOURLY:
        return amount * 8.0
    if salary_type == SalaryType.MONTHLY:
        return amount / 26.0
    return None


class MatchingService:
    """
    Explainable Smart Matching Engine
    Calculates a deterministic match score between a Worker and a Job.
    Weights: Skills (35%), Location (20%), Experience (15%), Salary (10%), Work Type (10%), Availability (5%), Category (5%)
    """

    WEIGHTS = {
        "skills": 35,
        "location": 20,
        "experience": 15,
        "salary": 10,
        "work_type": 10,
        "availability": 5,
        "category": 5,
    }

    @staticmethod
    def calculate_match(worker: WorkerProfile, job: Job) -> Dict[str, Any]:
        explanations = []
        factors = {}

        skills_score, skills_exp = MatchingService._calc_skills(worker, job)
        factors["skills"] = skills_score
        if skills_exp:
            explanations.append(skills_exp)

        loc_score, loc_exp = MatchingService._calc_location(worker, job)
        factors["location"] = loc_score
        if loc_exp:
            explanations.append(loc_exp)

        exp_score, exp_exp = MatchingService._calc_experience(worker, job)
        factors["experience"] = exp_score
        if exp_exp:
            explanations.append(exp_exp)

        sal_score, sal_exp = MatchingService._calc_salary(worker, job)
        factors["salary"] = sal_score
        if sal_exp:
            explanations.append(sal_exp)

        wt_score, wt_exp = MatchingService._calc_work_type(worker, job)
        factors["work_type"] = wt_score
        if wt_exp:
            explanations.append(wt_exp)

        avail_score, avail_exp = MatchingService._calc_availability(worker, job)
        factors["availability"] = avail_score
        if avail_exp:
            explanations.append(avail_exp)

        cat_score, cat_exp = MatchingService._calc_category(worker, job)
        factors["category"] = cat_score
        if cat_exp:
            explanations.append(cat_exp)

        final_score = (
            (factors["skills"] / 100 * MatchingService.WEIGHTS["skills"])
            + (factors["location"] / 100 * MatchingService.WEIGHTS["location"])
            + (factors["experience"] / 100 * MatchingService.WEIGHTS["experience"])
            + (factors["salary"] / 100 * MatchingService.WEIGHTS["salary"])
            + (factors["work_type"] / 100 * MatchingService.WEIGHTS["work_type"])
            + (factors["availability"] / 100 * MatchingService.WEIGHTS["availability"])
            + (factors["category"] / 100 * MatchingService.WEIGHTS["category"])
        )

        # Enforce mandatory skill eligibility ceiling: workers missing mandatory
        # skills should remain below 50% and rank after qualified candidates.
        required = job.required_skills or []
        mandatory_reqs = [req for req in required if getattr(req, "is_mandatory", False)]
        if mandatory_reqs:
            worker_skill_ids = {ws.skill_id for ws in (worker.skills or [])}
            matched_mandatory = sum(1 for req in mandatory_reqs if req.skill_id in worker_skill_ids)
            if matched_mandatory == 0:
                final_score = min(final_score, 35.0)
            elif matched_mandatory < len(mandatory_reqs):
                partial_cap = 35.0 + 14.0 * (matched_mandatory / len(mandatory_reqs))
                final_score = min(final_score, partial_cap)

        # Enforce availability ceiling so UNAVAILABLE / BUSY workers do not
        # outrank eligible AVAILABLE candidates.
        avail_status = getattr(worker, "availability_status", None)
        if avail_status == AvailabilityStatus.UNAVAILABLE:
            final_score = min(final_score, 40.0)
        elif avail_status == AvailabilityStatus.BUSY:
            final_score = min(final_score, 75.0)

        return {
            "job_id": str(job.id),
            "score": int(round(final_score)),
            "factors": factors,
            "explanations": explanations,
        }

    @staticmethod
    def _calc_skills(worker: WorkerProfile, job: Job) -> Tuple[int, Optional[Dict]]:
        required = job.required_skills or []
        if not required:
            return 50, {"key": "matching.skills.none_required", "args": {}}

        worker_skill_ids = {ws.skill_id for ws in (worker.skills or [])}
        total_weight = 0.0
        matched_weight = 0.0
        matched_count = 0

        for req in required:
            w = 2.0 if getattr(req, "is_mandatory", False) else 1.0
            total_weight += w
            if req.skill_id in worker_skill_ids:
                matched_weight += w
                matched_count += 1

        score = int(round((matched_weight / total_weight) * 100)) if total_weight > 0 else 50
        exp = {"key": "matching.skills.matched", "args": {"matched": matched_count, "total": len(required)}}
        return score, exp

    @staticmethod
    def _calc_location(worker: WorkerProfile, job: Job) -> Tuple[int, Optional[Dict]]:
        # Use geographic Haversine distance when coordinates are present on both sides
        if (
            worker.latitude is not None
            and worker.longitude is not None
            and job.latitude is not None
            and job.longitude is not None
        ):
            dist_km = haversine_distance_km(worker.latitude, worker.longitude, job.latitude, job.longitude)
            if dist_km <= 10.0:
                return 100, {"key": "matching.location.exact", "args": {"city": job.city}}
            if dist_km <= 25.0:
                return 85, {"key": "matching.location.exact", "args": {"city": job.city}}
            if dist_km <= 50.0:
                return 65, {"key": "matching.location.state_only", "args": {"state": job.state}}
            if dist_km <= 100.0:
                return 40, {"key": "matching.location.state_only", "args": {"state": job.state}}
            return 10, {"key": "matching.location.mismatch", "args": {"city": job.city, "state": job.state}}

        if not worker.city or not worker.state:
            # Avoid inflating incomplete worker profiles with 100 points
            return 0, {"key": "matching.location.not_set", "args": {}}

        worker_city = worker.city.strip().lower()
        worker_state = worker.state.strip().lower()
        job_city = (job.city or "").strip().lower()
        job_state = (job.state or "").strip().lower()

        if worker_city == job_city and worker_state == job_state:
            return 100, {"key": "matching.location.exact", "args": {"city": job.city}}
        elif worker_state == job_state:
            return 50, {"key": "matching.location.state_only", "args": {"state": job.state}}
        else:
            return 0, {"key": "matching.location.mismatch", "args": {"city": job.city, "state": job.state}}

    @staticmethod
    def _calc_experience(worker: WorkerProfile, job: Job) -> Tuple[int, Optional[Dict]]:
        req_exp = job.experience_required or 0
        w_exp = worker.years_experience or 0

        if req_exp == 0:
            return (100 if w_exp > 0 else 50), {"key": "matching.experience.none_required", "args": {}}

        if w_exp >= req_exp:
            return 100, {"key": "matching.experience.meets", "args": {"worker_exp": w_exp, "req_exp": req_exp}}

        if w_exp == 0:
            return 0, {"key": "matching.experience.missing", "args": {"req_exp": req_exp}}

        score = int((w_exp / req_exp) * 100)
        return score, {"key": "matching.experience.partial", "args": {"worker_exp": w_exp, "req_exp": req_exp}}

    @staticmethod
    def _calc_salary(worker: WorkerProfile, job: Job) -> Tuple[int, Optional[Dict]]:
        if not worker.expected_salary or not worker.salary_type:
            return 50, None

        if not job.salary_min and not job.salary_max:
            return 50, None

        exp_salary = float(worker.expected_salary)
        job_max_raw = float(job.salary_max) if job.salary_max is not None else None
        job_min_raw = float(job.salary_min) if job.salary_min is not None else None

        if worker.salary_type == job.salary_type:
            exp_val = exp_salary
            j_max = job_max_raw
            j_min = job_min_raw
        else:
            w_daily = _to_daily_salary(exp_salary, worker.salary_type)
            j_max = _to_daily_salary(job_max_raw, job.salary_type) if job_max_raw is not None else None
            j_min = _to_daily_salary(job_min_raw, job.salary_type) if job_min_raw is not None else None
            if w_daily is None or (j_max is None and j_min is None):
                return 40, None
            exp_val = w_daily

        if j_max is not None:
            if exp_val <= j_max:
                return 100, {"key": "matching.salary.fits_range", "args": {}}
            if exp_val <= j_max * 1.15:
                return 50, {"key": "matching.salary.above_max", "args": {}}
            return 0, {"key": "matching.salary.above_max", "args": {}}

        if j_min is not None:
            if exp_val <= j_min:
                return 100, {"key": "matching.salary.meets_min", "args": {}}
            if exp_val <= j_min * 1.2:
                return 60, {"key": "matching.salary.above_min", "args": {}}
            return 0, {"key": "matching.salary.above_min", "args": {}}

        return 50, None

    @staticmethod
    def _calc_work_type(worker: WorkerProfile, job: Job) -> Tuple[int, Optional[Dict]]:
        if not worker.preferred_work_types:
            return 40, None

        if job.work_type.value in worker.preferred_work_types:
            return 100, {"key": "matching.work_type.matches", "args": {}}

        return 0, {"key": "matching.work_type.mismatch", "args": {}}

    @staticmethod
    def _calc_availability(worker: WorkerProfile, job: Job) -> Tuple[int, Optional[Dict]]:
        if worker.availability_status == AvailabilityStatus.AVAILABLE:
            return 100, {"key": "matching.availability.available", "args": {}}
        elif worker.availability_status == AvailabilityStatus.BUSY:
            return 25, {"key": "matching.availability.busy", "args": {}}
        else:
            return 0, {"key": "matching.availability.unavailable", "args": {}}

    @staticmethod
    def _calc_category(worker: WorkerProfile, job: Job) -> Tuple[int, Optional[Dict]]:
        job_cat_name = getattr(getattr(job, "category", None), "name", None)
        if not job_cat_name:
            return 50, None
        target = job_cat_name.strip().lower()
        for ws in (worker.skills or []):
            skill_cat = getattr(getattr(ws, "skill", None), "category", None)
            if skill_cat and skill_cat.strip().lower() == target:
                return 100, None
        return 40, None
