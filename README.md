# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some Oxlint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the Oxlint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and Oxlint's TypeScript related rules in your project.
# SWASTHYA

## AI-Powered Healthcare Journey Platform

> From Medical Records to a Connected Healthcare Journey

SWASTHYA is an AI-powered healthcare continuity platform designed to transform fragmented medical records from hospitals, laboratories, doctors, diagnostic centres, and patient-uploaded documents into a unified, understandable, and evidence-linked healthcare journey.

Instead of simply storing medical records, SWASTHYA connects them into a chronological healthcare journey and helps authorized healthcare professionals and patients understand what has happened, what information is documented, and what follow-up actions are explicitly recorded.

---

## 🚨 Problem

Patients often receive healthcare from multiple hospitals, doctors, departments, and laboratories.

Their information may be distributed across:

- EMRs
- Laboratory reports
- Prescriptions
- Discharge summaries
- Consultation notes
- PDFs
- Medical scans and images

This fragmentation can make it difficult to:

- understand a patient's complete history
- transfer information between healthcare providers
- identify previous investigations
- track the patient's healthcare journey
- understand complex medical terminology
- identify documented follow-up actions

---

## 💡 Our Solution

SWASTHYA provides an intelligent healthcare continuity layer that:

1. Identifies the patient
2. Collects medical information from multiple sources
3. Processes documents using AI and OCR
4. Converts extracted information into structured healthcare data
5. Reconstructs the patient's longitudinal journey
6. Explains medical terminology in simpler language
7. Detects possible duplicate investigations
8. Detects conflicting documented information
9. Extracts explicitly documented follow-up actions
10. Provides source-linked evidence
11. Supports role-based access
12. Enables consent-controlled information sharing

---

## ⭐ Key Features

### 1. Contactless Biometric Patient Identification

SWASTHYA supports biometric facial identification using a webcam for enrolled patients.

Workflow:

Camera
→ Face Detection
→ Liveness Check
→ Face Embedding
→ Matching
→ Patient Identification
→ Role-Based Access

Fallback mechanisms can be used when biometric identification is unavailable or unsuccessful.

---

### 2. CareGraph

CareGraph transforms disconnected medical documents into a chronological healthcare journey.

Example:

Consultation
↓
Investigation
↓
Laboratory Result
↓
Imaging
↓
Prescription
↓
Follow-up
↓
Pending Documented Action

Each event can be linked back to its source document.

---

### 3. AI Document Intelligence

SWASTHYA can process healthcare documents such as:

- Laboratory reports
- Prescriptions
- Discharge summaries
- Consultation notes
- Radiology reports
- PDFs
- Images

Pipeline:

Upload
→ OCR
→ Document Classification
→ Information Extraction
→ Structured Data
→ CareGraph Update

---

### 4. Medical Terminology Explanation

Complex medical terminology can be presented with an accessible explanation while preserving the original source information.

SWASTHYA is designed to explain documented information rather than replace clinical decision-making.

---

### 5. Duplicate Investigation Detection

The system can identify possible repeated investigations across records.

Example:

CBC
Hospital A — 5 Sept

CBC
Hospital B — 7 Sept

The system flags this as:

"Possible Duplicate Investigation"

The system does not independently instruct clinicians to avoid a test.

---

### 6. Conflict Detection

SWASTHYA can identify potentially conflicting documented information.

Example:

Document A:
Medication X

Document B:
Medication Y

The system presents both sources for verification rather than silently selecting one.

---

### 7. NextStep Engine

SWASTHYA extracts explicitly documented actions such as:

- Follow-up
- Review
- Referral
- Pending results
- Scheduled review
- Documented repeat investigation

These are source-backed and are not generated medical recommendations.

---

### 8. Consent-Based Sharing

Patients can authorize selected information for a limited period.

Example:

Current Episode
✓

Recent Reports
✓

Full History
✗

Access Duration:
24 Hours

Every access can be recorded in the audit trail.

---

### 9. Role-Based Access Control

Different roles receive different levels of information.

| Role | Main Access |
|------|-------------|
| Patient | Own records, journey, sharing |
| Receptionist | Identity, appointment, check-in |
| Doctor | Authorized clinical information |
| Laboratory | Relevant orders and result submission |
| Admin | System monitoring and audit |

---

## 🏗️ System Architecture

```text
                SWASTHYA
                    |
        +-----------+-----------+
        |           |           |
     Patient    Reception     Doctor
        |           |           |
        +-----------+-----------+
                    |
                   Lab
                    |
                    v
              Secure Backend
                    |
        +-----------+-----------+
        |           |           |
    PostgreSQL    AI/OCR    Biometric
        |           |           |
        +-----------+-----------+
                    |
                    v
                CareGraph
                    |
          Timeline + Evidence
                    |
              Consent + Audit
              
