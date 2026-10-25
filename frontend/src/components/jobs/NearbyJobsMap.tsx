import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { useTranslation } from 'react-i18next'
import type { JobListItem } from '../../types'

interface NearbyJobsMapProps {
  jobs: JobListItem[]
  workerLocation: { lat: number; lng: number } | null
  radiusKm?: number | null
  selectedJobId?: string | null
  onSelectJob?: (jobId: string) => void
}

export default function NearbyJobsMap({
  jobs,
  workerLocation,
  radiusKm,
  selectedJobId,
  onSelectJob,
}: NearbyJobsMapProps) {
  const { t } = useTranslation()
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<L.Map | null>(null)
  const markersLayerRef = useRef<L.LayerGroup | null>(null)
  const radiusCircleRef = useRef<L.Circle | null>(null)
  const workerMarkerRef = useRef<L.Marker | null>(null)

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current) return

    if (!mapInstanceRef.current) {
      const initialLat = workerLocation?.lat ?? 20.5937
      const initialLng = workerLocation?.lng ?? 78.9629
      const initialZoom = workerLocation ? 13 : 5

      const map = L.map(mapContainerRef.current, {
        center: [initialLat, initialLng],
        zoom: initialZoom,
        zoomControl: true,
        attributionControl: true,
      })

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors',
      }).addTo(map)

      const markersLayer = L.layerGroup().addTo(map)
      markersLayerRef.current = markersLayer
      mapInstanceRef.current = map
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove()
        mapInstanceRef.current = null
        markersLayerRef.current = null
        radiusCircleRef.current = null
        workerMarkerRef.current = null
      }
    }
  }, [])

  // Invalidate size on container resize / toggle
  useEffect(() => {
    const timer = setTimeout(() => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.invalidateSize()
      }
    }, 150)
    return () => clearTimeout(timer)
  }, [])

  // Update Markers & Radius Circle
  useEffect(() => {
    const map = mapInstanceRef.current
    const markersLayer = markersLayerRef.current
    if (!map || !markersLayer) return

    markersLayer.clearLayers()

    if (radiusCircleRef.current) {
      map.removeLayer(radiusCircleRef.current)
      radiusCircleRef.current = null
    }

    if (workerMarkerRef.current) {
      map.removeLayer(workerMarkerRef.current)
      workerMarkerRef.current = null
    }

    const boundsPoints: L.LatLngExpression[] = []

    // 1. Worker Location Marker & Radius Circle
    if (workerLocation && typeof workerLocation.lat === 'number' && typeof workerLocation.lng === 'number') {
      const workerLatLng: [number, number] = [workerLocation.lat, workerLocation.lng]
      boundsPoints.push(workerLatLng)

      // Pulsing blue worker marker
      const workerIcon = L.divIcon({
        className: 'worker-location-pin',
        html: `
          <div style="position: relative; width: 28px; height: 28px; display: flex; align-items: center; justify-content: center;">
            <div style="position: absolute; width: 28px; height: 28px; border-radius: 50%; background-color: rgba(59, 130, 246, 0.3); animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>
            <div style="width: 16px; height: 16px; border-radius: 50%; background-color: #2563EB; border: 3px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>
          </div>
        `,
        iconSize: [28, 28],
        iconAnchor: [14, 14],
      })

      const workerMarker = L.marker(workerLatLng, { icon: workerIcon, zIndexOffset: 1000 }).addTo(map)
      workerMarker.bindPopup(`
        <div style="font-family: inherit; font-size: 13px; line-height: 1.4; padding: 2px;">
          <strong style="color: #1D4ED8;">📍 ${t('jobs.locationActive', 'Near your location')}</strong>
          <div style="color: #64748B; font-size: 11px; margin-top: 2px;">
            ${workerLocation.lat.toFixed(4)}, ${workerLocation.lng.toFixed(4)}
          </div>
        </div>
      `)
      workerMarkerRef.current = workerMarker

      // Search Radius Circle
      if (radiusKm && radiusKm > 0) {
        const circle = L.circle(workerLatLng, {
          radius: radiusKm * 1000,
          color: '#3B82F6',
          weight: 1.5,
          opacity: 0.8,
          fillColor: '#60A5FA',
          fillOpacity: 0.1,
          dashArray: '4, 4',
        }).addTo(map)
        radiusCircleRef.current = circle
      }
    }

    // 2. Job Markers
    const jobsWithCoords = jobs.filter(
      j => typeof j.latitude === 'number' && typeof j.longitude === 'number'
    )

    jobsWithCoords.forEach((job) => {
      const lat = job.latitude!
      const lng = job.longitude!
      const jobLatLng: [number, number] = [lat, lng]
      boundsPoints.push(jobLatLng)

      const isSelected = selectedJobId === job.id
      const isUrgent = job.is_urgent

      const pinBgColor = isSelected ? '#1E40AF' : isUrgent ? '#DC2626' : '#059669'
      const pinBorderColor = isSelected ? '#93C5FD' : '#FFFFFF'

      const jobIcon = L.divIcon({
        className: 'job-location-pin',
        html: `
          <div style="position: relative; width: 32px; height: 38px; cursor: pointer; transform: translate(-50%, -100%);">
            <svg width="32" height="38" viewBox="0 0 32 38" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M16 0C7.163 0 0 7.163 0 16C0 26.5 16 38 16 38C16 38 32 26.5 32 16C32 7.163 24.837 0 16 0Z" fill="${pinBgColor}" stroke="${pinBorderColor}" stroke-width="2"/>
              <circle cx="16" cy="15" r="6" fill="white"/>
            </svg>
            ${isUrgent ? '<div style="position: absolute; top: -4px; right: -4px; width: 10px; height: 10px; background: #EF4444; border: 2px solid white; border-radius: 50%;"></div>' : ''}
          </div>
        `,
        iconSize: [32, 38],
        iconAnchor: [16, 38],
        popupAnchor: [0, -38],
      })

      const marker = L.marker(jobLatLng, { icon: jobIcon })

      const salaryFormatted = job.salary_min && job.salary_max
        ? `₹${job.salary_min.toLocaleString()} – ₹${job.salary_max.toLocaleString()}`
        : job.salary_min
        ? `From ₹${job.salary_min.toLocaleString()}`
        : t('jobs.salaryNegotiable', 'Salary Negotiable')

      const employerName = job.employer.organization_name || job.employer.full_name

      const distanceBadge = job.distance_km != null
        ? `<div style="display: inline-flex; align-items: center; gap: 4px; background: #ECFDF5; color: #065F46; border: 1px solid #A7F3D0; padding: 2px 8px; border-radius: 9999px; font-size: 11px; font-weight: 600; margin-top: 6px;">
            <span>📍 ~${job.distance_km} km</span>
            ${job.estimated_travel_time ? `<span style="color: #047857;">• ${job.estimated_travel_time}</span>` : ''}
          </div>`
        : ''

      const addressHtml = job.address_detail
        ? `<div style="color: #475569; font-size: 11px; margin-top: 2px;">📍 ${job.address_detail}, ${job.city}</div>`
        : `<div style="color: #475569; font-size: 11px; margin-top: 2px;">📍 ${job.city}, ${job.state}</div>`

      const popupHtml = `
        <div style="font-family: inherit; font-size: 13px; max-width: 250px; line-height: 1.4; padding: 2px;">
          <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 4px;">
            ${isUrgent ? '<span style="background: #FEE2E2; color: #DC2626; font-size: 10px; font-weight: 700; padding: 1px 6px; border-radius: 9999px;">⚡ ' + t('jobs.urgent', 'Urgent') + '</span>' : ''}
            <span style="background: #F1F5F9; color: #334155; font-size: 10px; font-weight: 600; padding: 1px 6px; border-radius: 9999px;">${job.work_type}</span>
          </div>
          <div style="font-weight: 700; font-size: 14px; color: #0F172A; margin-bottom: 2px;">${job.title}</div>
          <div style="color: #64748B; font-size: 12px; margin-bottom: 4px;">${employerName}</div>
          ${addressHtml}
          ${distanceBadge}
          <div style="color: #2563EB; font-weight: 700; font-size: 13px; margin-top: 6px;">${salaryFormatted}</div>
          <div style="margin-top: 10px; padding-top: 8px; border-top: 1px solid #E2E8F0;">
            <a href="/worker/jobs/${job.id}" style="display: block; text-align: center; background: #2563EB; color: white; padding: 6px 12px; border-radius: 6px; font-size: 12px; font-weight: 600; text-decoration: none;">
              ${t('jobs.viewDetails', 'View Job Details')} &rarr;
            </a>
          </div>
        </div>
      `

      marker.bindPopup(popupHtml)

      marker.on('click', () => {
        if (onSelectJob) onSelectJob(job.id)
      })

      markersLayer.addLayer(marker)
    })

    // Fit Bounds
    if (boundsPoints.length > 1) {
      const bounds = L.latLngBounds(boundsPoints)
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 })
    } else if (boundsPoints.length === 1) {
      map.setView(boundsPoints[0], 13)
    }
  }, [jobs, workerLocation, radiusKm, selectedJobId, t, onSelectJob])

  return (
    <div className="relative w-full rounded-xl overflow-hidden border border-gray-200 shadow-sm bg-white">
      <div
        ref={mapContainerRef}
        className="w-full h-[420px] sm:h-[480px] z-0"
        style={{ minHeight: '380px' }}
      />
      {jobs.filter(j => j.latitude && j.longitude).length === 0 && !workerLocation && (
        <div className="absolute inset-0 bg-white/70 backdrop-blur-xs flex items-center justify-center p-6 text-center z-10 pointer-events-none">
          <div className="bg-white p-4 rounded-xl shadow-md border border-gray-100 max-w-sm">
            <p className="font-semibold text-gray-800 text-sm">
              {t('jobs.noMappedJobs', 'No jobs with map coordinates found')}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              {t('jobs.useLocationOrListPrompt', 'Use your location or switch to List View to see all available jobs.')}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
