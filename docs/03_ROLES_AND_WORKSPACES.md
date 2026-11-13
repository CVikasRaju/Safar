# 03 — Roles and Workspaces

## Student Portal

### Navigation
- Journey Planner.
- My Travel Submissions.
- Report a Disruption.
- Journey Alerts.

### Journey Planner
Collect origin, destination, travel date, and required arrival time. Search and display the three calculated recommendation categories.

### Travel submissions
Allow a student to submit intended origin, destination, date, arrival time, and group size. Use the minimum personal information necessary. Display submission confirmation and aggregate demand without exposing identities in government charts.

### Disruption reporting
Visible CTA: `REPORT BUS NOT ARRIVED / DISRUPTION`.

Required fields:
- Route number.
- Expected bus number.
- Bus stop.
- Expected arrival time.
- Report type.
- Optional description.

On submit:
- Create a unique report.
- Save submission timestamp.
- Set status `UNVERIFIED`.
- Show a confirmation/reference ID.
- Do not change bus status.
- Do not claim that the report has been confirmed.

### Student alerts
Display relevant:
- Upcoming event warnings.
- Route disruption warnings.
- Unverified report status.
- Confirmed incident updates.
- Approved replacement allocation.
- Revised journey and arrival estimates.

Only show a student's own report details in their own view if the prototype supports identity/session association. Otherwise use clearly labelled demo-session records.

## Government Control Centre

### Dashboard indicators
- Total buses.
- Operating buses.
- Available buses.
- Unavailable buses.
- Expected student demand.
- Available seats.
- Potential shortage.
- Active disruptions.
- Unverified student reports.
- Routes requiring attention.

### Navigation sections
1. Fleet Overview.
2. Regional Event Intelligence.
3. Student Demand Analytics.
4. Bus Replacement Recommendations.
5. Route Monitoring.
6. Disruption Reports.
7. Alerts and Recommendations.

### Operations
Authorities can monitor routes/fleet, manage events, inspect demand, review reports, verify/reject/mark duplicate, confirm incidents, rank replacements, approve/reject recommendations, and review system recommendations.

Use explicit confirmation for consequential simulated operations.
