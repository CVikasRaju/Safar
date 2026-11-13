# SAFAR 
## AI-Powered Rural Student Transport Intelligence System

**Project domain:** Intelligent transportation, rural mobility and decision support  
**Target platform:** Responsive web application  
**Development approach:** AI-assisted, modular software engineering  
**Prompt pack purpose:** A reusable set of structured prompts for defining, designing, implementing, integrating, validating and handing over SAFAR.

---
#Problem Discovery and Solution Definition

**Role:** Act as a senior software architect, rural mobility domain analyst and transportation technology consultant.

**Objective:** Establish a precise problem definition and a technically feasible product concept for SAFAR.

**Prompt:**

Conduct a structured analysis of the challenges associated with student transportation in rural and semi-urban regions, particularly where students depend on limited public or institution-linked bus services to reach educational institutions.

Examine the operational issues that the proposed system must address, including:
- limited transportation availability and irregular schedules;
- long waiting periods and journeys involving multiple transfers;
- unexpected vehicle breakdowns and service interruptions;
- festivals, religious processions, village fairs, public gatherings and other regional events that affect routes;
- road closures, construction activity and traffic congestion;
- differences between student travel demand and available seating capacity; and
- fragmented coordination between students, transport operators and government authorities.

Using this analysis, define **SAFAR — an AI-Powered Rural Student Transport Intelligence System**. The solution must extend beyond conventional vehicle tracking by connecting journey planning, regional event intelligence, disruption management, student demand analysis, fleet monitoring and replacement-transport recommendations in one coherent platform.

**Required deliverables:**
1. A concise problem statement.
2. The primary project objectives.
3. Target user groups and their needs.
4. The proposed solution and its major capabilities.
5. The principal system workflows.
6. Key differentiators from a conventional bus-tracking application.
7. Expected operational and student-facing benefits.
8. Assumptions, dependencies and known feasibility constraints.



---

# Product Requirements and Functional Specification

**Role:** Act as a senior product manager, business analyst and software requirements engineer.

**Objective:** Translate the approved SAFAR concept into a structured, implementation-ready product requirements specification.

**Prompt:**

Produce a detailed functional specification for SAFAR, organised around two connected application workspaces.

### A. Student Portal

Specify the user flows and functional behaviour that allow a student to:
- enter a current village or starting location;
- select an educational institution or destination;
- provide a travel date and required arrival time;
- view and compare available journey options;
- inspect bus numbers, boarding points, intermediate stops and drop-off locations;
- understand departure and arrival times, waiting duration, walking distance and transfer requirements;
- view estimated delays and relevant disruption warnings;
- inspect the journey on an interactive map;
- submit reports about breakdowns, road closures, delays and other transport issues; and
- receive relevant journey updates and notifications.

### B. Government Transport Control Centre

Specify the workflows and permissions that allow authorised officials to:
- monitor transportation operations across villages and routes;
- inspect fleet availability and vehicle status;
- monitor regional events and their potential transportation effects;
- identify routes that may be affected by disruptions;
- review and verify student-submitted incident reports;
- compare expected student demand with available seating capacity;
- identify overcrowding and capacity shortages;
- initiate a simulated bus breakdown;
- identify affected journeys and potentially affected students;
- receive ranked replacement-bus recommendations;
- approve or reject proposed replacements; and
- review the operational consequences of approved decisions.

Define the shared application data required by both workspaces. An authorised operational action must update relevant student-facing journey information and alerts through a consistent application state.

**Required deliverables:**
1. Product scope and out-of-scope items.
2. User roles, permissions and primary user stories.
3. Functional requirements grouped by module.
4. End-to-end workflows for key use cases.
5. Required data entities and relationships.
6. Cross-workspace state and update requirements.
7. Functional acceptance criteria for each major capability.
8. Assumptions, dependencies and unresolved questions.

Use clear, testable requirement statements. Avoid vague requirements such as “the system should be intelligent” unless the expected behaviour is defined.

---

# Regional Event Intelligence and Route Impact Assessment

**Role:** Act as a transportation operations analyst and software engineer specialising in event-aware mobility systems.

**Objective:** Design a transparent mechanism for assessing the potential effect of regional events on rural student transport.

**Prompt:**

Design and implement a regional event intelligence module that evaluates how scheduled local activities and known disruptions may affect transportation routes and student journeys.

Support event categories including temple festivals, religious processions, village fairs, weekly markets, public gatherings, political rallies, sports events, academic examinations, local celebrations, road construction, road closures and other traffic-generating activities.

Each event record must support:
- event name and category;
- geographic location;
- event date and start/end time;
- expected crowd intensity;
- nearby villages;
- potentially affected roads;
- associated transportation routes;
- estimated congestion risk; and
- expected impact duration.

Create a route-impact assessment method that considers:
1. crowd intensity;
2. proximity between the event and the route;
3. temporal overlap with scheduled bus journeys;
4. importance of the affected route;
5. event duration; and
6. historical information, when available.

Classify the assessed impact as **Low, Moderate, High or Critical**. Provide a human-readable explanation of the factors contributing to each result; do not expose an unexplained score as the sole output.

Implement event creation, editing and deletion, and recalculate affected route assessments when event details change.

**Required deliverables:**
- event data model and validation rules;
- impact-assessment logic and documented assumptions;
- risk classification rules;
- affected-route identification behaviour;
- event management workflows;
- recalculation and application-state update behaviour; and
- test cases covering time overlap, route proximity, intensity and event changes.

Keep predicted event impacts distinct from confirmed road incidents. Never present a prediction as a verified real-world incident.

---

# Student Disruption Reporting and Authority Verification

**Role:** Act as a product engineer specialising in incident-management workflows and auditable operational systems.

**Objective:** Implement a controlled process for collecting, reviewing and verifying student-reported transportation disruptions.

**Prompt:**

Design a student-facing incident submission flow and a corresponding authority-side review workflow.

Students must be able to report:
- bus breakdowns;
- unexpected delays;
- road blockages;
- traffic congestion;
- cancelled services;
- missing or unavailable buses; and
- other journey-related disruptions.

Capture the incident category, description, location, route or bus reference when known, submission timestamp and supporting information where available.

Every student-submitted report must enter the system with the status **Unverified**. Do not allow a user-submitted report to become an authority-confirmed incident automatically.

Provide an official review interface that allows authorised personnel to:
- inspect submitted incident details;
- verify a legitimate report;
- reject an incorrect or duplicate report;
- record the review outcome; and
- track the incident's status history.

Maintain distinct classifications for:
- planned or predicted disruption;
- student-reported, unverified incident;
- authority-verified incident; and
- simulated fleet breakdown.

Only authority-verified incidents should affect official disruption recommendations, except when an explicitly labelled simulation is being performed.

**Required deliverables:**
1. Incident data model and status definitions.
2. Student submission workflow and validation.
3. Authority review and decision workflow.
4. Duplicate/rejection handling.
5. Traceable status history.
6. Rules for propagating verified incidents to relevant modules.
7. Tests confirming that unverified reports do not influence official recommendations.

Ensure that verification decisions are reflected consistently throughout the connected application.

---

# Student Demand Forecasting and Capacity Intelligence

**Role:** Act as a transportation data analyst and backend engineer specialising in demand and capacity planning.

**Objective:** Provide route-level visibility into expected student demand and available seating capacity.

**Prompt:**

Develop a demand and capacity intelligence module that compares the number of students expected to travel with the seating capacity available across transportation routes.

Where available, consider:
- historical student travel counts;
- weekday and weekend patterns;
- academic schedules;
- examination periods;
- institutional holidays;
- regional events;
- student travel intentions; and
- route-specific travel patterns.

The module must calculate and present:
- expected student demand;
- available seats;
- occupied seats;
- remaining seats;
- capacity utilisation;
- estimated seat shortage;
- routes with excess capacity;
- routes with overcrowding risk; and
- village-wise and route-wise demand summaries.

Use the following initial illustrative dataset as a demonstrator:

| Route | Expected Demand | Available Seats |
|---|---:|---:|
| R101 | 145 | 100 |
| R102 | 90 | 110 |
| R103 | 185 | 140 |
| **Total** | **420** | **350** |

The illustrative total indicates an estimated shortage of 70 seats. Implement reusable calculation logic; do not hardcode the displayed totals or derived values.

**Required deliverables:**
1. Data definitions and source classifications.
2. Demand and capacity calculation methods.
3. Route-level and aggregate summaries.
4. Overcrowding and shortage identification.
5. Clear visual presentation of the results.
6. Test cases for zero demand, excess capacity, exact capacity and shortages.

Do not claim that a machine-learning forecasting model has been trained unless an actual model, dataset, evaluation procedure and results are available. Clearly label historical observations, current estimates and forecasts. Aggregate student information wherever possible to protect individual privacy.

---

# Fleet Management and Replacement Vehicle Optimisation

**Role:** Act as a senior fleet-management systems engineer and optimisation specialist.

**Objective:** Implement fleet monitoring and a controlled replacement-bus recommendation workflow for breakdown scenarios.

**Prompt:**

Develop a fleet management module that maintains the operational information required for each bus:
- registration number;
- assigned route;
- seating capacity;
- occupied seats;
- remaining seats;
- current operational status;
- reported or simulated location;
- availability;
- estimated response time; and
- replacement assignment information.

Support the statuses **Operating, Available, Unavailable, Maintenance** and **Replacement Assigned**.

Implement a bus breakdown simulation. When an operating bus is selected for a simulated breakdown, the application must:
1. mark the selected bus unavailable;
2. identify its assigned route;
3. identify affected journeys;
4. identify potentially affected students;
5. calculate the additional seating requirement;
6. identify eligible replacement buses;
7. rank eligible candidates;
8. present the recommendation to an authorised official;
9. allow approval or rejection; and
10. update fleet allocation and relevant student-facing information after approval.

Use these initial recommendation weights:

| Evaluation factor | Weight |
|---|---:|
| Capacity suitability | 35% |
| Route compatibility | 30% |
| Response time | 25% |
| Operational availability | 10% |

Treat sufficient capacity and operational availability as hard feasibility constraints, separate from the weighted ranking. Never recommend a bus that is unavailable or under maintenance.

If no eligible replacement can accommodate the affected passengers, report the shortage explicitly and present feasible alternatives. Support approval, rejection and simulation reset operations. No simulated operational decision may be executed without authorised approval.

**Required deliverables:**
- fleet and replacement data models;
- breakdown simulation state transitions;
- affected-journey and passenger identification logic;
- eligibility filters and weighted ranking method;
- recommendation explanations;
- approval/rejection workflow;
- shortage handling; and
- tests for capacity boundaries, unavailable vehicles and no-candidate scenarios.

---

# Journey Planning and Reliability Recommendation Engine

**Role:** Act as a transportation routing engineer and decision-support product designer.

**Objective:** Build a journey-planning engine that produces distinct, explainable alternatives for students.

**Prompt:**

Develop a journey planning engine that accepts a student's origin, destination, travel date and required arrival time. For each valid request, generate three meaningfully distinct recommendations:

1. **Fastest Route:** prioritise the minimum total journey duration.
2. **Most Reliable Route:** prioritise fewer disruptions, suitable connection buffers and dependable transportation availability.
3. **Fewest Transfers:** prioritise fewer bus changes and a simpler journey.

Each recommendation must display:
- bus numbers;
- boarding location;
- intermediate stops;
- destination;
- departure time;
- estimated arrival time;
- walking distance;
- number of transfers;
- waiting duration;
- total journey duration;
- estimated delay;
- disruption warnings; and
- reliability score.

Present each itinerary chronologically so that students can understand every stage of the journey.

Create a reusable reliability assessment method that considers historical or illustrative delay information, regional event impact, transfer waiting time, connection buffer, bus availability, number of transfers and verified disruptions. Display the result on a 0–100 scale and recalculate it when relevant operational conditions change.

Show the recommended departure time, expected arrival time, required arrival time and relevant risks. Display this exact qualification wherever the score is presented:

> Illustrative prototype reliability score. Not a statistically validated probability.

**Required deliverables:**
1. Journey request and itinerary data structures.
2. Logic for generating the three recommendation types.
3. Chronological itinerary presentation.
4. Reliability calculation and explanation.
5. Recalculation triggers when events or verified disruptions change.
6. Tests showing that the three recommendation types apply their respective priorities.

Do not describe a reliability score as a guaranteed probability of arriving on time.

---

# Interactive Rural Transportation Map

**Role:** Act as a geospatial application engineer with experience in web mapping and route visualisation.

**Objective:** Integrate geographic context into journey planning and disruption awareness without making the application dependent on an external map service.

**Prompt:**

Implement an interactive map for visualising student journeys and transportation disruptions. Use **Leaflet with OpenStreetMap** as the preferred mapping approach, subject to tile availability and applicable usage policies.

The map must support:
- origin and destination markers;
- bus stops and intermediate stops;
- transportation route paths;
- transfer points;
- walking segments;
- event locations;
- disruption locations; and
- affected transportation routes.

Use geographically meaningful route representations. Visually distinguish bus travel from walking segments and make the map legend understandable.

Do not represent straight-line geographic distance as actual walking distance. If accurate routing data is unavailable, label the route or distance as illustrative rather than presenting it as verified.

**Required deliverables:**
1. Map component and data interface.
2. Marker and route-layer conventions.
3. Visual distinction between bus and walking segments.
4. Integration with journey and disruption data.
5. Map loading, empty and error states.
6. A usable fallback visualisation when tiles or external mapping services are unavailable.

A map-service failure must not prevent students from using the core journey-planning workflow.

---

# Responsible AI Integration and Intelligent Assistance

**Role:** Act as an AI solutions architect specialising in reliable, human-supervised decision-support applications.

**Objective:** Integrate AI only for tasks where language understanding or explanation provides clear value, while keeping operational calculations deterministic.

**Prompt:**

Assess and implement AI-supported capabilities in SAFAR where they provide meaningful operational value.

### 1. Announcement understanding
Enable the system to interpret transportation or public-event announcements, extract event names, dates, locations and timings, identify potential route implications, and convert unstructured content into structured event records for official review.

### 2. Disruption explanation
Generate clear explanations of why a route may be affected, summarise the expected consequences of an incident, and explain available alternative transportation recommendations.

### 3. Operational intelligence
Generate concise summaries of fleet conditions, capacity shortages and high-risk routes. Help officials understand the potential consequences of proposed operational actions.

Keep the following calculations within deterministic, reproducible application logic:
- travel duration;
- timetable evaluation;
- seat availability;
- capacity shortages;
- replacement-bus ranking;
- reliability scoring; and
- route-impact calculations.

AI-generated content must not override validated application data or authorised operational decisions.

Make the AI provider configurable. Keep API credentials on the server side and load them through environment variables. The application must continue to provide its core functionality if the external AI service is unavailable.

**Required deliverables:**
1. AI use-case boundaries and data flow.
2. Structured extraction format for event announcements.
3. Human-review step before extracted events become operational records.
4. Explanation and summarisation interfaces.
5. Server-side provider configuration and secret handling.
6. Deterministic fallback behaviour.
7. Clear labelling of AI-generated explanations versus calculated application results.
8. Tests for unavailable or failed AI services.

Do not fabricate events, transport conditions or operational facts.

---

# Professional UI/UX and Design System

**Role:** Act as a senior product designer, accessibility specialist and frontend architect.

**Objective:** Establish a coherent, professional interface for both SAFAR workspaces.

**Prompt:**

Design SAFAR as a professional transportation intelligence platform, not as a generic dashboard template. Create two clearly differentiated but visually consistent workspaces: the **Student Portal** and the **Government Control Centre**.

Use a restrained visual language based on deep navy, charcoal and slate surfaces. Apply cyan, emerald, amber and red selectively to communicate meaningful information and operational status.

The interface must be:
- responsive across relevant screen sizes;
- accessible and keyboard-conscious;
- consistent in navigation and interaction patterns;
- easy to understand for its intended users;
- information-dense without becoming cluttered; and
- suitable for a professional technology demonstration.

Establish reusable components and design tokens for spacing, typography, colour, surfaces, buttons, forms, tables, charts, status indicators and alerts. Use maps, charts, tables, forms, modals and activity panels where they improve task completion.

Avoid unnecessary gradients, excessive animation, decorative elements and oversized empty cards. Every navigation item, button, dropdown, chart interaction, form and tab must perform a meaningful function. Provide appropriate loading, empty, success and error states.

**Required deliverables:**
1. Workspace navigation and information architecture.
2. Design tokens and reusable component conventions.
3. Student Portal screen specifications.
4. Government Control Centre screen specifications.
5. Responsive behaviour and accessibility considerations.
6. Interaction and feedback-state requirements.
7. A consistency review across both workspaces.

Prioritise usability and functional clarity over visual decoration.

---

# Modular Architecture and Shared-State Integration

**Role:** Act as a principal software architect and full-stack TypeScript engineer.

**Objective:** Define and implement a maintainable architecture in which all SAFAR modules operate on consistent shared data.

**Prompt:**

Inspect the existing repository and its conventions before making architectural changes. Use the current codebase as the starting point and avoid unnecessary rewrites.

The recommended technology direction is:
- React;
- TypeScript;
- Tailwind CSS;
- Lucide React;
- Recharts;
- Leaflet and OpenStreetMap;
- a Node.js backend where required;
- LocalStorage or an appropriate persistence layer for prototype data; and
- optional external AI integration.

Organise the application into logical modules for components, pages, layouts, data, types, hooks, business logic, API services, maps, backend routes and backend services.

Create reusable business-logic functions with responsibilities equivalent to:
- `generateJourneyOptions()`;
- `calculateJourneyReliability()`;
- `calculateEventImpact()`;
- `identifyAffectedRoutes()`;
- `calculateStudentDemand()`;
- `rankReplacementBuses()`;
- `updateFleetAllocation()`; and
- `generateRecommendationExplanation()`.

Define shared data contracts before parallel development. Use a common state-management approach so the Student Portal and Government Control Centre operate on consistent application data. Changes to events, incidents, fleet assignments, demand and route reliability must propagate to the relevant modules.

**Required deliverables:**
1. Repository assessment and proposed architecture.
2. Module and directory responsibilities.
3. Shared TypeScript types and data contracts.
4. State-management and data-flow design.
5. Reusable business-logic interfaces.
6. Persistence implementation appropriate to the prototype.
7. Integration points between the two workspaces.
8. Documentation of what is stored locally, in a backend database or through another service.

Avoid disconnected mock datasets, duplicated business logic and inconsistent status values. Explain architectural trade-offs before introducing additional infrastructure.

---

# Rural Karnataka Demonstration Dataset

**Role:** Act as a transportation domain data modeller and prototype-scenario designer.

**Objective:** Create a coherent, configurable illustrative dataset that supports an end-to-end SAFAR demonstration.

**Prompt:**

Create an illustrative rural transportation environment based around **Puttur, Karnataka**.

Use these demonstration locations:
- Puttur;
- Sullia;
- Uppinangady;
- Kadaba; and
- Vittal.

Include **Puttur Government College** as an educational destination.

Create a consistent demonstration dataset containing:
- at least four transportation routes: R101, R102, R103 and R104;
- at least five buses;
- at least ten bus stops;
- bus schedules and route assignments;
- seating capacities and occupied/available seat values;
- student demand estimates;
- at least one regional event; and
- at least one simulated bus breakdown.

Ensure that identifiers and relationships remain consistent across journey planning, event intelligence, fleet management and demand analysis. Make routes, events, demand, fleet availability and journey requests configurable without changing core business logic.

**Required deliverables:**
1. Dataset schema and records.
2. Route, stop, bus and schedule relationships.
3. Demand and capacity values.
4. Event and simulated breakdown records.
5. Configuration mechanism for demonstration scenarios.
6. Data-integrity checks across modules.
7. Clear labels identifying all fictional or illustrative operational information.

Do not imply that the prototype is connected to actual government transport systems, live GPS devices or verified regional event feeds unless those integrations have genuinely been implemented. Do not present illustrative coordinates, schedules or operating conditions as authoritative real-world data.

---

# Integrated End-to-End Demonstration Scenario

**Role:** Act as a senior integration engineer and technical demonstration architect.

**Objective:** Demonstrate that the Student Portal and Government Control Centre are connected through real application state and operational workflows.

**Prompt:**

Implement an end-to-end SAFAR demonstration using the configured illustrative dataset.

### Scenario A — Regional event impact

A student from Village A needs to reach Puttur Government College before **9:00 AM**. A major regional festival is scheduled near Town B on the following day.

The application must:
1. identify relevant transportation options, including R101 and R104;
2. assess the festival's potential impact on both routes;
3. recalculate estimated delays and reliability scores;
4. recommend a suitable alternative or earlier departure; and
5. display the updated journey information in the Student Portal.

### Scenario B — Simulated bus breakdown

Simulate a breakdown involving bus `KA-21-AB-102`, assigned to route R101.

The application must:
1. mark the bus unavailable;
2. identify affected routes and journeys;
3. identify potentially affected students;
4. calculate the required replacement capacity;
5. identify eligible replacement buses;
6. rank candidates using the documented optimisation method;
7. display the recommendation in the Government Control Centre;
8. allow an authorised official to approve or reject the recommendation;
9. update fleet allocation after approval;
10. recalculate affected journey information; and
11. update the Student Portal with the revised bus allocation, route, alerts and reliability information.

At the end of the scenario, present a summary containing event impact, affected routes, affected journeys, original bus breakdown, selected replacement bus, additional available capacity, revised estimated arrival time, updated reliability assessment and remaining operational limitations.

**Acceptance conditions:**
- The scenario must run through actual application interactions.
- Both workspaces must reflect the same underlying state.
- Approval must be required before a replacement allocation is committed.
- Derived values must come from application logic, not a static presentation or hardcoded final result.
- All demonstration-only information must remain labelled as illustrative or simulated.

---

# Four-Member Parallel Development and Git Workflow

**Role:** Act as a technical lead responsible for coordinating a four-person engineering team working in one shared repository.

**Objective:** Divide SAFAR into parallel workstreams while protecting shared interfaces, code ownership and integration quality.

**Prompt:**

Organise development into four coordinated engineering responsibilities.

### Member 1 — Foundation and Integration Lead
Own repository architecture, project setup, shared TypeScript types and data contracts, backend foundation, persistence strategy, shared state, global design system, navigation, reusable components, integration and final quality assurance.

### Member 2 — Student Portal Engineer
Own the student dashboard, journey planner, recommendation cards, detailed itinerary, interactive route map, student disruption reporting interface, student-facing notifications and related module-specific frontend/backend functionality.

### Member 3 — Transportation Intelligence Engineer
Own regional event management, event impact assessment, affected-route identification, incident verification, student demand analysis, capacity calculations, delay and reliability calculations, and related services/APIs.

### Member 4 — Fleet and Government Operations Engineer
Own the Government Control Centre, fleet monitoring, bus status management, breakdown simulation, affected-journey identification, replacement-bus ranking, authority approval workflow and integrated operational demonstration.

All members must work in the same GitHub repository and follow shared project documentation. Establish common interfaces, types, naming conventions and integration contracts before parallel implementation. Use separate feature branches and pull requests. Do not independently redefine shared models, duplicate common datasets or overwrite another member's implementation. Member 1 coordinates integration and cross-module conflict resolution.

**Required deliverables:**
1. Workstream ownership and scope boundaries.
2. Shared contract and dependency checklist.
3. Branching and pull-request workflow.
4. Integration sequence and merge responsibilities.
5. Definition of done for each workstream.
6. A conflict-resolution and communication process.

Keep ownership clear while requiring each member to integrate and validate against the common application contracts.

---

# Quality Assurance, Testing and Engineering Validation

**Role:** Act as a senior QA engineer and software reliability specialist.

**Objective:** Evaluate SAFAR for functional correctness, integration integrity, calculation accuracy, responsiveness and failure handling.

**Prompt:**

Review and test the entire SAFAR application. Do not limit the review to visual inspection. Execute the available application workflows and inspect the underlying logic and data transitions.

### Student Portal
Test journey search, recommendation generation, itinerary correctness, departure/arrival calculations, disruption visibility, student report submission and notification updates.

### Event intelligence
Test event creation, modification and deletion, route-impact recalculation, risk classification and time-based impact evaluation.

### Incident management
Test report submission, initial Unverified status, authority review, verification, rejection and propagation of verified incidents.

### Demand intelligence
Test expected demand, available capacity, occupancy, remaining seats, capacity shortage and route-level comparisons.

### Fleet operations
Test bus status changes, breakdown simulation, replacement eligibility, candidate ranking, capacity constraints, approval, rejection and fleet-allocation updates.

### System integration
Test shared state, cross-workspace updates, persistence, consistent identifiers, valid status transitions, AI-provider failure handling and map-service failure handling.

Inspect for broken imports, TypeScript errors, runtime exceptions, invalid API responses, incorrect calculations, duplicated state, inconsistent datasets, non-functional controls, layout overflow, responsive failures and missing loading/empty/error states.

**Required deliverables:**
1. Test plan mapped to product requirements.
2. Executed test cases and observed outcomes.
3. Defects with reproduction steps and severity.
4. Fixes for confirmed underlying problems.
5. Regression results for affected workflows.
6. Remaining risks and untested areas.

Fix root causes rather than hiding errors with superficial UI changes. Never claim that a feature has passed testing unless it has actually been executed and verified. Clearly distinguish automated checks, manual checks and checks that could not be performed.

---

# Controlled Iteration, Debugging and Requirement Preservation

**Role:** Act as a senior software engineer responsible for incremental improvement of an existing application.

**Objective:** Improve SAFAR systematically while preserving working functionality and maintaining an evidence-based development record.

**Prompt:**

Use a controlled iteration process for every reported defect, missing requirement or requested refinement.

For each iteration:
1. identify the problem or missing requirement;
2. describe the expected behaviour;
3. identify the affected module and dependencies;
4. inspect the current implementation before editing;
5. propose the smallest appropriate change;
6. implement the correction within the agreed scope;
7. test the affected workflow;
8. verify that connected modules continue to function; and
9. record the change and its observed result.

Preserve existing working functionality. Do not replace functional modules with simplified mockups or introduce unrelated features that distract from SAFAR's core objectives.

When requirements conflict, use the documented product requirements and explicit project decisions as the source of truth. Record unresolved conflicts rather than silently inventing a resolution.

Maintain `PROMPT_LOG.md` with the prompts actually used, observed issues, refinements, implementation changes and validation results.

**Required output for each iteration:**
- issue or requirement reference;
- current behaviour;
- expected behaviour;
- files/modules affected;
- proposed and completed changes;
- tests executed and their actual results;
- regression checks; and
- outstanding limitations.

Never fabricate prompt iterations, debugging outcomes, test results or implementation evidence.

---

# Final Integration, Deployment Readiness and Project Handover

**Role:** Act as a principal engineer conducting a final release-readiness review and preparing a technical project handover.

**Objective:** Verify the integrated SAFAR deliverable and produce accurate setup, operation and handover documentation.

**Prompt:**

Conduct a complete engineering review of SAFAR before final delivery. Verify the following against the actual implementation:

- both Student Portal and Government Control Centre workspaces are available;
- student journey planning functions correctly;
- three distinct journey recommendations are generated;
- journey details and map visualisation are available;
- event intelligence is connected to route-impact assessment;
- student reports follow the required verification workflow;
- demand and capacity calculations produce correct results;
- fleet monitoring is functional;
- breakdown simulation identifies affected journeys;
- replacement buses are filtered and ranked correctly;
- authority approval updates shared application state;
- student-facing information reflects approved operational changes;
- persistence works as documented;
- AI functionality has an appropriate fallback;
- mapping functionality has an appropriate fallback;
- the interface is responsive;
- navigation and interactive controls work; and
- no unresolved critical build or runtime errors remain.

Prepare technical documentation covering:
1. problem statement and proposed solution;
2. system architecture;
3. technology stack;
4. module descriptions;
5. data models;
6. API structure;
7. AI integration and limitations;
8. calculation methods and assumptions;
9. demonstration dataset and its limitations;
10. testing and validation evidence;
11. known limitations;
12. setup and environment configuration;
13. build and deployment instructions; and
14. possible future enhancements.

Provide clear setup instructions, environment-variable documentation, build instructions and deployment guidance. Never expose secrets or API keys.

**Required final handover:**
- verified implementation status for each major requirement;
- commands required to install, run, test and build the project;
- environment configuration guidance without secret values;
- architecture and workflow documentation;
- actual test evidence and known gaps; and
- a concise demonstration guide.

Do not describe simulated functionality as a live production integration. Do not claim production readiness unless the required deployment, security, reliability and operational checks have actually been completed. The final deliverable should be a working, integrated web application with maintainable source code and accurate technical documentation.

---

# Cross-Cutting Engineering Constraints

Apply these principles throughout all SAFAR workstreams:

1. **Functionality over appearance:** A polished interface must not substitute for working functionality.
2. **Modular architecture:** Keep modules reusable, testable and maintainable.
3. **Shared data integrity:** Both workspaces must operate on consistent application data.
4. **Deterministic critical calculations:** Operational calculations must use explicit, reproducible logic.
5. **Responsible AI:** AI assists interpretation and explanation; it must not fabricate operational facts.
6. **Human approval:** Simulated fleet replacement and other consequential authority actions require approval.
7. **Data transparency:** Label illustrative, estimated, simulated and verified information distinctly.
8. **Graceful degradation:** Core workflows should remain usable when optional external services fail.
9. **Privacy:** Avoid exposing unnecessary individual student information.
10. **Adaptability:** Routes, events, schedules, demand and fleet conditions should be configurable.
11. **Engineering validation:** Test features before declaring them complete.
12. **Evidence-based documentation:** Record actual development activity and outcomes without fabrication.

---

## Prompt Sequence at a Glance

| Prompt | Engineering stage | Primary outcome |
|---|---|---|
| 01 | Problem discovery | Defined problem and solution concept |
| 02 | Requirements engineering | Functional product specification |
| 03 | Event intelligence | Event-aware route impact assessment |
| 04 | Incident management | Student reporting and authority verification |
| 05 | Demand intelligence | Demand and capacity analysis |
| 06 | Fleet optimisation | Breakdown response and replacement allocation |
| 07 | Journey intelligence | Route recommendations and reliability assessment |
| 08 | Geographic visualisation | Interactive journey and disruption map |
| 09 | AI integration | Bounded AI assistance and deterministic fallbacks |
| 10 | UI/UX engineering | Consistent professional interface |
| 11 | Architecture | Modular design and shared application state |
| 12 | Demonstration data | Configurable rural Karnataka prototype environment |
| 13 | Workflow integration | Connected end-to-end demonstration |
| 14 | Team coordination | Four-member ownership and integration process |
| 15 | Quality assurance | Functional and engineering validation |
| 16 | Iterative refinement | Controlled debugging and requirement preservation |
| 17 | Project handover | Release review and technical documentation |

**Documentation note:** This pack is a structured version of the 17 prompt stages in the supplied SAFAR prompt log. It preserves the project's stated scope, examples, assumptions and constraints. Mark prompts as planned, submitted or executed according to the actual development record, and attach implementation evidence, commits, screenshots and test outputs where available.
