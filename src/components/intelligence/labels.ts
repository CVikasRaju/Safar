// SAFAR — Intelligence module labels and formatting (Member 3)
// Single source of truth for display labels used by event, demand, incident and
// reliability views. Keeps status language consistent across the module.

import type {
  CrowdIntensity,
  EventCategory,
  IncidentSeverity,
  IncidentStatus,
  IncidentType,
  ReportStatus,
  ReportType,
  RiskLevel,
} from '../../domain/types';

export const EVENT_CATEGORY_LABELS: Record<EventCategory, string> = {
  TEMPLE_FESTIVAL: 'Temple Festival',
  RELIGIOUS_PROCESSION: 'Religious Procession',
  VILLAGE_FAIR: 'Village Fair',
  WEEKLY_MARKET: 'Weekly Market',
  EXAMINATION: 'National / State Examination',
  SPORTS_EVENT: 'Sports Event',
  PUBLIC_GATHERING: 'Public Gathering',
  POLITICAL_RALLY: 'Political Rally',
  CELEBRATION: 'Celebration',
  CONSTRUCTION: 'Construction',
  ROAD_CLOSURE: 'Road Closure',
  CUSTOM: 'Custom',
};

export const CROWD_LABELS: Record<CrowdIntensity, string> = {
  LOW: 'Low',
  MODERATE: 'Moderate',
  HIGH: 'High',
  VERY_HIGH: 'Very High',
};

export const RISK_BADGE_CLASS: Record<RiskLevel, string> = {
  LOW: 'badge-emerald',
  MODERATE: 'badge-amber',
  HIGH: 'badge-orange',
  CRITICAL: 'badge-rose',
};

export const REPORT_STATUS_LABELS: Record<ReportStatus, string> = {
  UNVERIFIED: 'UNVERIFIED STUDENT REPORT',
  VERIFIED: 'VERIFIED REPORT — INCIDENT NOT YET CONFIRMED',
  REJECTED: 'REJECTED REPORT',
  DUPLICATE: 'DUPLICATE REPORT',
  CLOSED: 'CLOSED REPORT',
};

export const REPORT_STATUS_BADGE_CLASS: Record<ReportStatus, string> = {
  UNVERIFIED: 'badge-amber',
  VERIFIED: 'badge-cyan',
  REJECTED: 'badge-slate',
  DUPLICATE: 'badge-slate',
  CLOSED: 'badge-emerald',
};

export const REPORT_TYPE_LABELS: Record<ReportType, string> = {
  BUS_NOT_ARRIVED: 'Bus not arrived',
  BUS_BREAKDOWN: 'Bus breakdown',
  MECHANICAL_FAILURE: 'Mechanical failure',
  DRIVER_ISSUE: 'Driver-reported issue',
  CANCELLATION: 'Unexpected cancellation',
  ROAD_BLOCKAGE: 'Road blockage',
  ROUTE_DIVERSION: 'Route diversion',
  CAPACITY_SHORTAGE: 'Insufficient capacity',
  CUSTOM: 'Other issue',
};

export const INCIDENT_TYPE_LABELS: Record<IncidentType, string> = {
  BUS_BREAKDOWN: 'Bus breakdown',
  MECHANICAL_FAILURE: 'Mechanical failure',
  DRIVER_ISSUE: 'Driver-reported issue',
  ROAD_BLOCKAGE: 'Road blockage',
  ROUTE_DIVERSION: 'Route diversion',
  CANCELLATION: 'Unexpected cancellation',
  CAPACITY_SHORTAGE: 'Insufficient capacity',
  CUSTOM: 'Other incident',
};

export const INCIDENT_SEVERITY_LABELS: Record<IncidentSeverity, string> = {
  LOW: 'Low',
  MEDIUM: 'Medium',
  HIGH: 'High',
  CRITICAL: 'Critical',
};

export const SEVERITY_BADGE_CLASS: Record<IncidentSeverity, string> = {
  LOW: 'badge-slate',
  MEDIUM: 'badge-amber',
  HIGH: 'badge-orange',
  CRITICAL: 'badge-rose',
};

export const INCIDENT_STATUS_LABELS: Record<IncidentStatus, string> = {
  ACTIVE: 'ACTIVE',
  RESOLVED: 'RESOLVED',
  CLOSED: 'CLOSED',
};

export function formatDateTime(iso: string | undefined): string {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function shortId(id: string, length = 14): string {
  return id.length > length ? `${id.slice(0, length)}…` : id;
}
