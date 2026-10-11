from typing import List, Dict, Any, Tuple, Optional
from app.models.models import WorkerProfile, Job, AvailabilityStatus

class MatchingService:
    """
    Explainable Smart Matching Engine
    Calculates a deterministic match score between a Worker and a Job.
    Weights: Skills (35%), Location (20%), Experience (15%), Work Type (10%), Salary (10%), Availability (5%), Category (5%)
    """
    
    WEIGHTS = {
        "skills": 35,
        "location": 20,
        "experience": 15,
        "salary": 10,
        "work_type": 10,
        "availability": 5,
        "category": 5
    }

    @staticmethod
    def calculate_match(worker: WorkerProfile, job: Job) -> Dict[str, Any]:
        explanations = []
        factors = {}
        
        # 1. Skills (35%)
        skills_score, skills_exp = MatchingService._calc_skills(worker, job)
        factors['skills'] = skills_score
        if skills_exp:
            explanations.append(skills_exp)
            
        # 2. Location (20%)
        loc_score, loc_exp = MatchingService._calc_location(worker, job)
        factors['location'] = loc_score
        if loc_exp:
            explanations.append(loc_exp)
            
        # 3. Experience (15%)
        exp_score, exp_exp = MatchingService._calc_experience(worker, job)
        factors['experience'] = exp_score
        if exp_exp:
            explanations.append(exp_exp)
            
        # 4. Salary (10%)
        sal_score, sal_exp = MatchingService._calc_salary(worker, job)
        factors['salary'] = sal_score
        if sal_exp:
            explanations.append(sal_exp)
            
        # 5. Work Type (10%)
        wt_score, wt_exp = MatchingService._calc_work_type(worker, job)
        factors['work_type'] = wt_score
        if wt_exp:
            explanations.append(wt_exp)
            
        # 6. Availability (5%)
        avail_score, avail_exp = MatchingService._calc_availability(worker, job)
        factors['availability'] = avail_score
        if avail_exp:
            explanations.append(avail_exp)
            
        # 7. Category (5%)
        cat_score, cat_exp = MatchingService._calc_category(worker, job)
        factors['category'] = cat_score
        if cat_exp:
            explanations.append(cat_exp)
            
        # Final Score
        final_score = (
            (factors['skills'] / 100 * MatchingService.WEIGHTS['skills']) +
            (factors['location'] / 100 * MatchingService.WEIGHTS['location']) +
            (factors['experience'] / 100 * MatchingService.WEIGHTS['experience']) +
            (factors['salary'] / 100 * MatchingService.WEIGHTS['salary']) +
            (factors['work_type'] / 100 * MatchingService.WEIGHTS['work_type']) +
            (factors['availability'] / 100 * MatchingService.WEIGHTS['availability']) +
            (factors['category'] / 100 * MatchingService.WEIGHTS['category'])
        )
        
        return {
            "job_id": str(job.id),
            "score": int(round(final_score)),
            "factors": factors,
            "explanations": explanations
        }

    @staticmethod
    def _calc_skills(worker: WorkerProfile, job: Job) -> Tuple[int, Optional[Dict]]:
        required = job.required_skills
        if not required:
            return 100, {"key": "matching.skills.none_required", "args": {}}
            
        worker_skill_ids = {ws.skill_id for ws in worker.skills}
        matched = sum(1 for req in required if req.skill_id in worker_skill_ids)
        
        score = int((matched / len(required)) * 100)
        exp = {"key": "matching.skills.matched", "args": {"matched": matched, "total": len(required)}}
        return score, exp

    @staticmethod
    def _calc_location(worker: WorkerProfile, job: Job) -> Tuple[int, Optional[Dict]]:
        if not worker.city or not worker.state:
            return 100, {"key": "matching.location.not_set", "args": {}}
            
        worker_city = worker.city.strip().lower()
        worker_state = worker.state.strip().lower()
        job_city = job.city.strip().lower()
        job_state = job.state.strip().lower()
        
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
            return 100, {"key": "matching.experience.none_required", "args": {}}
            
        if w_exp >= req_exp:
            return 100, {"key": "matching.experience.meets", "args": {"worker_exp": w_exp, "req_exp": req_exp}}
            
        if w_exp == 0:
            return 0, {"key": "matching.experience.missing", "args": {"req_exp": req_exp}}
            
        score = int((w_exp / req_exp) * 100)
        return score, {"key": "matching.experience.partial", "args": {"worker_exp": w_exp, "req_exp": req_exp}}

    @staticmethod
    def _calc_salary(worker: WorkerProfile, job: Job) -> Tuple[int, Optional[Dict]]:
        if not worker.expected_salary or not worker.salary_type:
            return 100, None # Neutral score if worker hasn't set salary expectations
            
        if worker.salary_type != job.salary_type:
            return 100, None # Neutral score if types mismatch (can't directly compare hourly to monthly)
            
        exp_salary = float(worker.expected_salary)
        
        if job.salary_max:
            job_max = float(job.salary_max)
            if exp_salary <= job_max:
                return 100, {"key": "matching.salary.fits_range", "args": {}}
            else:
                return 0, {"key": "matching.salary.above_max", "args": {}}
        elif job.salary_min:
            job_min = float(job.salary_min)
            if exp_salary <= job_min:
                return 100, {"key": "matching.salary.meets_min", "args": {}}
            else:
                return 0, {"key": "matching.salary.above_min", "args": {}}
                
        return 100, None # Job has no salary specified

    @staticmethod
    def _calc_work_type(worker: WorkerProfile, job: Job) -> Tuple[int, Optional[Dict]]:
        if not worker.preferred_work_types:
            return 100, None # Neutral
            
        if job.work_type.value in worker.preferred_work_types:
            return 100, {"key": "matching.work_type.matches", "args": {}}
            
        return 0, {"key": "matching.work_type.mismatch", "args": {}}

    @staticmethod
    def _calc_availability(worker: WorkerProfile, job: Job) -> Tuple[int, Optional[Dict]]:
        if worker.availability_status == AvailabilityStatus.AVAILABLE:
            return 100, {"key": "matching.availability.available", "args": {}}
        elif worker.availability_status == AvailabilityStatus.BUSY:
            return 0, {"key": "matching.availability.busy", "args": {}}
        else:
            return 0, {"key": "matching.availability.unavailable", "args": {}}

    @staticmethod
    def _calc_category(worker: WorkerProfile, job: Job) -> Tuple[int, Optional[Dict]]:
        # Worker doesn't have a category field natively to compare against.
        # Neutral score.
        return 100, None
