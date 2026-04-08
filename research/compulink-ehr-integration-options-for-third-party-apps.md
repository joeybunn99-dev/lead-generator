# Research: Compulink EHR Integration Options for Third-Party Apps

**Date:** 2026-04-08
**Cycles:** 2
**Final Score:** 5.6/10
**Playbook Version:** 1.0

## Executive Summary

Compulink offers a **read-only FHIR R4 API** with 14 clinical resources (Patient, AllergyIntolerance, Condition, MedicationRequest, etc.) and OAuth 2.0 authentication. Write-back is not available through FHIR — it requires the API Partner Program and explicit customer sponsorship. The most actionable path for Clarity Bridge is a **SMART on FHIR standalone launch** using Compulink's existing OAuth 2.0 endpoint for read access, with write-back deferred to "structured suggestions" that clinicians review in-app rather than pushing data directly into the EHR. Compulink publishes zero public developer documentation or code samples, making this a "register and negotiate" integration, not a self-service one.

## Detailed Findings

### Available Integration Methods

**1. FHIR R4 API (Read-Only)**
- RESTful API following hl7.org/fhir/R4/http.html
- US Core STU 3.1.1 compliant
- OAuth 2.0 authentication (RFC 6749)
- Supported resources: AllergyIntolerance, CarePlan, CareTeam, Condition, DiagnosticReport (Note + Lab), DocumentReference, Goal, Immunization, MedicationRequest, Observation (Lab + Smoking Status), Vital Signs, Implantable Device, Procedure
- Bulk Data Access (STU 1.0.1) supported for group export
- No additional fees for standard API usage
- Practice must have active "Advantage Partnership Support Service" agreement

**2. ODBC / Data Dictionary (Server Installs Only)**
- "Point of Access API" connecting to Data Dictionary via user credentials
- Uses ODBC to submit SQL statements and fetch data
- Only available for **server-based** Compulink installations
- Cloud (RDP-based) installations likely cannot use this path
- More flexible than FHIR but less standardized

**3. API Partner Program**
- Registration: compulinkadvantage.com/apipartner/ or apipartners.compulink.net
- Requires: business info, product description, data elements needed, existing Compulink client references
- Contact: apipartner-support@compulinkadvantage.com / 800-456-4522
- No public technical documentation — partners get access after approval
- This is the only path to write-back capabilities

**4. Existing Third-Party Integrations**
- **Phreesia**: Only confirmed **bidirectional** integration partner (patient intake)
- **Review Wave**: Patient communication/marketing, cloud-synced data
- **Optify**: Manual setup requiring TeamViewer for server installs
- **Keragon**: Claims integration with 300+ tools, no technical details public

### Write-Back Strategy (from eClinicalWorks Analog)

The eClinicalWorks read vs write analysis provides the best blueprint for our situation:

1. **Start read-only, build value first.** Use FHIR to pull patient data into Clarity Bridge. Prove the app is useful before attempting writes.
2. **Evolve to "structured suggestions."** Instead of writing directly to the EHR, present suggestions that clinicians review and approve within Compulink. This avoids clinical liability.
3. **Negotiate contracted write access.** Production write access requires: customer sponsorship (Clarity Vision), security review, scope governance, environment configuration, commercial terms.
4. **Define the operational model first.** "The biggest mistakes happen when teams pick a technology before they define the operational model." Decide what truly needs write-back vs. what can live outside the EHR.

### SMART on FHIR Compatibility

- SMART on FHIR is **federally mandated** for ONC-certified EHRs — Compulink must support it
- Compulink's FHIR API already uses OAuth 2.0, making SMART launch compatible
- Two launch modes: EHR launch (from within Compulink) and standalone launch (independent app)
- Standalone launch is the path for Clarity Bridge — app runs independently, authenticates via OAuth, reads patient data
- SMART uses granular scopes (e.g., `user/Encounter.rs`) for permission control

### Middleware Options (if needed later)

- **Mirth Connect / Rhapsody**: Interface engines bridging FHIR read with HL7 v2 write
- **Hybrid pattern**: Deploy API layer on top of Compulink, listen for HL7 v2 internally, expose FHIR externally
- Only relevant for server-based installations with direct access

## Source Quality

| Source Type | Queries | Useful Findings | Rating |
|-------------|---------|-----------------|--------|
| Official site (Compulink) | 2 | Partner program, FHIR resource list | medium |
| Healthcare publication (6b.health) | 1 | Write-back evolution strategy | high |
| SMART on FHIR official docs | 1 | Launch specification, ONC mandate | high |
| Web search (general) | 4 | Integration guides, middleware patterns | medium |
| GitHub | 1 | Zero Compulink repos found | low |
| Reddit/Community | 1 | Zero discussions found | low |
| Third-party docs (Optify, Keragon) | 2 | Onboarding only, no technical details | low |

## Contradictions & Open Questions

- **No contradictions found.** All sources agree FHIR is read-only and write-back requires partner program.
- **Open:** Does Compulink Cloud actually support SMART on FHIR launch, or does the RDP-based architecture block it?
- **Open:** What specific write endpoints does the Partner Program unlock? HL7 v2? Custom REST? Direct database?
- **Open:** Does Clarity Vision (our target client) have a server-based or cloud-based Compulink installation? This determines whether ODBC is an option.
- **Open:** What is the timeline for Partner Program approval? Weeks? Months?

## Actionable Next Steps

1. **Ask Clarity Vision which Compulink version they run** — server-based vs. cloud determines integration options
2. **Register for the API Partner Program** at compulinkadvantage.com/apipartner/ — this is required regardless of approach
3. **Build a SMART on FHIR standalone launcher** using Compulink's OAuth 2.0 endpoint to read patient data (AllergyIntolerance, Condition, MedicationRequest, etc.)
4. **Design the app to present "structured suggestions"** rather than direct EHR writes — clinicians review and manually enter approved changes
5. **If server-based:** Explore ODBC/Data Dictionary access for richer read capabilities beyond FHIR
6. **Defer write-back** until the read-only app proves value, then negotiate contracted write access through the Partner Program with Clarity Vision's sponsorship

## Score History

| Cycle | Depth | Diversity | Corroboration | Actionability | Novelty | Composite |
|-------|-------|-----------|---------------|---------------|---------|-----------|
| 1 | 5 | 4 | 5 | 5 | 5 | 4.8 |
| 2 | 5 | 5 | 6 | 6 | 6 | 5.6 |

## Meta: What the Loop Learned

- **Most valuable source:** 6b.health eClinicalWorks read vs write article — not Compulink-specific but provided the exact strategic framework (read-only → suggestions → contracted writes) that applies to our situation
- **Least valuable source:** GitHub and Reddit — Compulink has zero community/open-source ecosystem. This is an enterprise silo.
- **Surprising discovery:** Compulink publishes essentially zero public developer documentation. The FHIR PDF is unreadable, the partner page is a registration form with no technical content, and no community has formed around their APIs. This is a "call us" integration, not a "read our docs" integration. Plan accordingly — budget time for partner program onboarding.

Sources:
- [Compulink API Partner Program](https://compulinkadvantage.com/apipartner/)
- [Compulink FHIR API Documentation (PDF)](https://compulinkadvantage.com/wp-content/uploads/2022/10/COMPULINK-FHIR-API-DOCUMENTATION.pdf)
- [eClinicalWorks Read vs Write APIs](https://6b.health/insight/eclinicalworks-ehr-integration-read-vs-write-apis-and-what-requires-contracted-access/)
- [SMART on FHIR Official Docs](https://docs.smarthealthit.org/)
- [SMART App Launch Specification](https://build.fhir.org/ig/HL7/smart-app-launch/)
- [Keragon Compulink Integration](https://www.keragon.com/integrations/compulink)
- [Optify Compulink Setup](https://support.optifyonline.com/knowledge/how-to-launch-the-compulink-integration-with-optify)
