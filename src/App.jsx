import { useState, useRef, useEffect, useCallback } from 'react'
import { supabase, initialsOf } from './lib/supabase'

/* ================================================================
   DISPLAY HELPERS (dates & db → UI status labels)
   ================================================================ */

function fmtDate(iso) {
  // Timestamps ("2026-09-15T21:04:00Z") format in local time; date-only
  // strings ("2026-09-15") parse as local calendar dates, not UTC.
  if (iso.includes('T')) {
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function localISODate(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function fmtTime(isoTimestamp) {
  return new Date(isoTimestamp).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
}

const DOC_STATUS_LABELS = { pending: 'Pending Review', approved: 'Approved', denied: 'Changes Requested' }
const TICKET_STATUS_LABELS = { open: 'Unanswered', answered: 'Replied', closed: 'Replied' }

const MOCK_DOC_PREVIEWS = {
  'JacobMichaelNCSEFParentReleaseForm.pdf': `NORTH CAROLINA SCIENCE AND ENGINEERING FAIR
PARENT / GUARDIAN RELEASE FORM — 2025–2026
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

STUDENT INFORMATION
Student Name:     Jacob Michael
School:           Green Level High School  |  Grade: 11
Project Title:    Examining the Impact of Manic-Like Defendant Behavior
                  on Juror Perception and Decision-Making in Simulated Trials
Project Category: Behavioral & Social Sciences

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

PARENT / GUARDIAN AUTHORIZATION

I, the undersigned parent or legal guardian, hereby grant permission for
my child to participate in NCSEF for the 2025–2026 competition year.

  ✓  My child may be photographed or filmed for fair publicity materials
  ✓  My child's name and project title may appear in official NCSEF publications
  ✓  NCSEF is not liable for loss of or damage to display materials
  ✓  My child will abide by all NCSEF and ISEF rules and code of conduct

EMERGENCY CONTACT
Name:    [Parent/Guardian Name]
Phone:   [Phone Number]
Email:   [Email Address]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Parent/Guardian Signature: _________________________  Date: Nov 6, 2025
Student Signature:         _________________________  Date: Nov 6, 2025`,

  '1-Checklist-for-Adult-Sponsor-stemrcform1.pdf': `ISEF FORM 1 — ADULT SPONSOR / RESEARCH PLAN CHECKLIST
Society for Science — 2025–2026
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Student:        Jacob Michael
Project Title:  Examining the Impact of Manic-Like Defendant Behavior
                on Juror Perception and Decision-Making in Simulated Trials
Adult Sponsor:  [Sponsor Name, Credentials]
Institution:    Green Level High School   |   Start Date: November 2025

PROJECT TYPE
  ☐ Engineering  ☐ Life Science  ☑ Behavioral & Social Sciences
  ☐ Chemistry    ☐ Physics/Math  ☐ Earth & Environmental Science

HAZARD IDENTIFICATION
  ☑  Human Participants (Form 4 required)
  ☐  Vertebrate Animals       ☐  Hazardous Biological Agents
  ☐  Hazardous Chemicals      ☐  Human/Animal Tissue
  ☐  None of the above

ADULT SPONSOR CERTIFICATION
I certify that I have reviewed this student's Research Plan (Form 1A),
all required pre-approvals are in place, and this student has received
adequate safety training appropriate to the project.

Sponsor Signature: _________________________  Date: ___________`,

  '1A-Student-Checklist-Research-Plan-Instructions1.pdf': `ISEF FORM 1A — STUDENT CHECKLIST & RESEARCH PLAN
Society for Science — 2025–2026
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

STUDENT CHECKLIST
  ☑  I have written a Research Plan (see below)
  ☑  My Adult Sponsor has read and approved this plan
  ☑  I have identified all required forms for my project type
  ☑  All required pre-approvals have been obtained
  ☑  I understand ISEF display and safety regulations

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

RESEARCH PLAN

Title:  Examining the Impact of Manic-Like Defendant Behavior on
        Juror Perception and Decision-Making in Simulated Trials

Research Question:
  Does manic-like defendant behavior in a simulated trial significantly
  affect mock jurors' verdicts, credibility ratings, and sentencing
  recommendations compared to a neutral behavioral presentation?

Hypothesis:
  Mock jurors exposed to manic-like defendant behavior will assign
  higher culpability and harsher sentences than those observing neutral
  behavior, independent of the evidence presented.

Variables:
  Independent:  Defendant behavior condition (manic-like vs. neutral)
  Dependent:    Verdict, sentencing severity (1–10), credibility (Likert 1–7)
  Controlled:   Case facts, evidence, juror demographics, script length

Methodology:
  n=60 adults via convenience sampling. Group A (n=30): manic-like
  transcript. Group B (n=30): neutral delivery, identical content.
  All participants complete anonymous post-trial questionnaire.
  Informed consent obtained prior to participation.

Data Analysis:
  Independent-samples t-tests, chi-square for categorical outcomes,
  Cohen's d for effect size. Significance threshold: p < 0.05.

Student Signature: _________________________  Date: Nov 6, 2025
Sponsor Signature: _________________________  Date: Nov 6, 2025`,

  '4-Sample-Informed-Consent1.pdf': `ISEF FORM 4 — SAMPLE INFORMED CONSENT
Society for Science — 2025–2026
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

STUDY: Examining the Impact of Manic-Like Defendant Behavior on
       Juror Perception and Decision-Making in Simulated Trials

INVESTIGATOR: Jacob Michael — Green Level High School

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

PURPOSE
This study investigates whether defendant behavioral presentation in a
simulated trial affects mock jurors' perceptions and decisions.

WHAT YOU WILL DO
  • Read a written trial transcript             (~10–12 min)
  • Complete a structured questionnaire          (~5–8 min)
  • Total time commitment:                      ~20 minutes

RISKS & BENEFITS
No risks beyond everyday life. No compensation offered.

CONFIDENTIALITY
All responses are fully anonymous. No identifying information collected.
Data stored securely and destroyed after analysis.

VOLUNTARY PARTICIPATION
Fully voluntary. Withdraw at any time by not submitting.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

By signing below, I confirm I am 18+, have read this form, and agree
to participate voluntarily.

Participant Signature: _________________________  Date: ___________`,

  '4-Human-Participants3.pdf': `ISEF FORM 4 — HUMAN PARTICIPANTS
Society for Science — 2025–2026
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Student:  Jacob Michael
Project:  Examining the Impact of Manic-Like Defendant Behavior
          on Juror Perception and Decision-Making in Simulated Trials

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

PARTICIPANT INFORMATION
  Estimated participants:      60
  Age range:                   18 and older (adults only)
  Will minors participate?     No
  Vulnerable population?       No

PROCEDURES
  Participants read a standardized written trial transcript and complete
  a structured questionnaire. No physical interaction, deception, or
  collection of sensitive personal data. Fully anonymous and voluntary.

  Informed consent obtained?   Yes (Form 4 AIC attached)
  Deception involved?          No
  Audio/video recording?       No

RISK ASSESSMENT
  Risk level:   Minimal — no risks beyond everyday life
  Mitigation:   Anonymous responses. Voluntary. Right to withdraw.

DATA HANDLING
  Storage:      Paper questionnaires in locked cabinet
  Identifiable? No — no names, emails, or IDs collected
  Disposal:     Destroyed after data entry and analysis complete

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Student:        _________________________  Date: Nov 6, 2025
Adult Sponsor:  _________________________  Date: ___________
SRC Member:     _________________________  Date: ___________`,
}

const ISEF_FORMS = [
  {
    id: 'f1', tag: 'Form 1', title: 'Adult Sponsor / Research Plan Checklist',
    pdfSrc: '/pdfs/1-Checklist-for-Adult-Sponsor.pdf',
    what: 'Required for all projects. Completed by the Adult Sponsor certifying they reviewed the research plan, all safety precautions are in place, and the student received adequate supervision before experimentation began.',
    how: [
      'Have your Adult Sponsor (not you) fill out and sign this form',
      'Sponsor confirms the Research Plan (Form 1A) was reviewed before any work began',
      'Sponsor identifies the project type and checks all applicable hazard categories',
      'Sponsor certifies student received safety training appropriate to the project',
      'Submit original with signature — photocopies not accepted',
    ],
  },
  {
    id: 'f1a', tag: 'Form 1A', title: 'Student Checklist & Research Plan',
    pdfSrc: '/pdfs/1A-Student-Checklist-Research-Plan-Instructions.pdf',
    what: 'Required for all projects. A structured 700-word research plan written by the student covering the research question, hypothesis, experimental design, variables, materials, procedures, and planned data analysis. Must be reviewed before experimentation begins.',
    how: [
      'Write your research question and hypothesis clearly in the opening section',
      'List all independent, dependent, and controlled variables explicitly',
      'Describe your complete experimental procedure step by step',
      'Outline your data collection method and planned statistical analysis',
      'Check every item on the student compliance checklist at the top of the form',
      'Have your Adult Sponsor review and date the plan before any work begins',
      'Stay within the 700-word limit for the written plan',
    ],
  },
  {
    id: 'f1b', tag: 'Form 1B', title: 'Continuation / Research Continuation Project',
    pdfSrc: '/pdfs/1B-Approval-Form.pdf',
    what: 'Required only if your project continues research from a previous ISEF-affiliated competition year. Documents what is new this year versus carried forward from prior work.',
    how: [
      "Attach your previous year's finalized, approved research plan",
      'List every procedure, dataset, and analysis that is genuinely new this year',
      'Explain how new work extends (and does not duplicate) prior findings',
      'Do NOT present prior-year data as new — this is a disqualifying violation',
      'Have your SRC/IRB review the continuation scope before submitting',
    ],
  },
  {
    id: 'f2', tag: 'Form 2', title: 'Qualified Scientist',
    pdfSrc: '/pdfs/2-Qualified-Scientist.pdf',
    what: 'Required when research is conducted at a university, hospital, government lab, or any regulated research institution with a supervising professional scientist.',
    how: [
      'Identify the supervising Qualified Scientist (PhD, MD, DVM, or equivalent)',
      'Scientist lists their institution, department, and relevant credentials',
      'Document the total hours of direct supervision provided',
      'Scientist describes the student\'s specific role and independent contributions',
      'Obtain the scientist\'s original signature',
    ],
  },
  {
    id: 'f3', tag: 'Form 3', title: 'Risk Assessment',
    pdfSrc: '/pdfs/3-Risk-Assessment.pdf',
    what: 'Required for projects involving any potentially hazardous substances or conditions — chemicals, high voltage, sharp instruments, extreme temperatures, lasers, or biological materials.',
    how: [
      'List every chemical, biological agent, radioactive material, or physical hazard',
      'For each hazard, specify exact safety precautions and containment measures',
      'List all required PPE for each hazard category',
      'Describe disposal procedures for any hazardous waste',
      'Obtain a signature from a qualified scientist familiar with the specific hazards',
    ],
  },
  {
    id: 'f4', tag: 'Form 4', title: 'Human Participants',
    pdfSrc: '/pdfs/4-Human-Participants.pdf',
    sampleConsentPdf: '/pdfs/4-Sample-Informed-Consent.pdf',
    what: 'Required whenever your project involves human subjects — surveys, interviews, cognitive tasks, behavioral observations, physiological measurements, or use of existing personal or medical data.',
    how: [
      'Describe all procedures involving human participants in plain language',
      'Confirm protocol was reviewed and approved before recruitment began',
      'Attach a signed Informed Consent form for every adult participant (18+)',
      'Attach signed Parental Consent AND Assent forms for minors',
      'Document how participant confidentiality and data security are maintained',
      'Obtain IRB approval or qualified Adult Sponsor sign-off',
    ],
  },
  {
    id: 'f5a', tag: 'Form 5A', title: 'Vertebrate Animals — Non-Regulated Site',
    pdfSrc: '/pdfs/5A-Vertebrate-Animal.pdf',
    what: 'Required for projects using vertebrate animals conducted at a home, school, or field site that is NOT a regulated research institution.',
    how: [
      'Identify the species, number of animals, and their source',
      'Describe housing conditions, feeding schedule, and daily care procedures',
      'Detail every experimental procedure and confirm minimal distress',
      'Identify the supervising veterinarian or qualified scientist',
      'Obtain SRC/IRB approval before acquiring any animals',
    ],
  },
  {
    id: 'f5b', tag: 'Form 5B', title: 'Vertebrate Animals — Regulated Research Institution',
    pdfSrc: '/pdfs/5B-Vertebrate-Animal.pdf',
    what: 'Required when vertebrate animal research is conducted at a university, hospital, or government laboratory covered by the Animal Welfare Act. Requires IACUC approval documentation.',
    how: [
      'Attach a copy of the institution\'s active IACUC approval',
      'List the IACUC protocol number and approval date',
      'Confirm the student was listed as a participant on the approved IACUC protocol',
      'Have the supervising Qualified Scientist sign and certify the student\'s involvement',
    ],
  },
  {
    id: 'f6a', tag: 'Form 6A', title: 'Potentially Hazardous Biological Agents',
    pdfSrc: '/pdfs/6A-Potentially-Hazardous-Biological-Agents.pdf',
    what: 'Required for any project using microorganisms, recombinant DNA/RNA, prions, or any biological material that could pose a risk to human health or the environment.',
    how: [
      'Identify every biological agent by full scientific name and Biosafety Level',
      'Describe containment procedures appropriate to each agent\'s BSL classification',
      'Detail sterilization, decontamination, and waste disposal protocols',
      'Obtain review and signature from an IBC member or qualified microbiologist',
    ],
  },
  {
    id: 'f6b', tag: 'Form 6B', title: 'Human and Vertebrate Animal Tissue',
    pdfSrc: '/pdfs/6B-Human-Vertebrate-Animal-Tissue.pdf',
    what: 'Required when your project uses human tissue, blood, body fluids, or primary cell cultures derived from humans or vertebrate animals — including commercially purchased or archived samples.',
    how: [
      'Specify the exact tissue type, source, and preservation state',
      'Confirm the tissue was obtained through an IRB-approved protocol',
      'Describe all Universal Precautions and PPE used when handling the material',
      'Detail your storage, labeling, and final disposal procedures',
    ],
  },
  {
    id: 'f7', tag: 'Form 7', title: 'Display and Safety Acknowledgment',
    pdfSrc: '/pdfs/7-Display-Safety-Acknowledgment.pdf',
    what: 'Required when your project is physically displayed at the fair. Confirms your backboard, models, and any devices follow the display size limits, electrical rules, and prohibited-items list.',
    how: [
      'Review the display size limits and the list of items not allowed on the exhibit floor',
      'Confirm any electrical components meet the fair\'s wiring and power rules',
      'Photographs and visuals must credit their source and have consent where people are shown',
      'Sign the acknowledgment and bring it with your project on setup day',
    ],
  },
  {
    id: 'ncsef', tag: 'NCSEF', title: 'Parent / Guardian Release Form',
    pdfSrc: '/pdfs/NCSEF-Parent-Release-Form-2026.pdf',
    what: 'North Carolina Science and Engineering Fair specific form. Required for all student participants. Parent/guardian grants permission for competition and acknowledges liability limitations.',
    how: [
      'Print and complete the form — electronic signatures not accepted at NCSEF',
      'Parent or legal guardian must sign (not the student)',
      'Student section must also be completed in full',
      'Include emergency contact information',
      'Submit to your club advisor by the published deadline',
    ],
  },
]

const WIZARD_QUESTIONS = [
  {
    id: 'q1',
    text: 'Does your project involve human participants — surveys, interviews, cognitive tasks, behavioral observations, physiological measurements, or use of any existing personal or medical data?',
    required: ['Form 4'],
    note: 'Includes simulated scenarios, jury studies, and online surveys',
  },
  {
    id: 'q2',
    text: 'Does your project use vertebrate animals (mice, rats, zebrafish, birds, reptiles, or any other vertebrate) in any part of the experimental process?',
    required: ['Form 5A', 'Form 5B'],
    note: 'Includes school, home, field, and regulated institution research sites',
  },
  {
    id: 'q3',
    text: 'Does your project use microorganisms, recombinant DNA/RNA, or any hazardous biological, chemical, or radioactive materials?',
    required: ['Form 3', 'Form 6A'],
    note: 'Select Yes if any of these apply — you may not need both forms',
  },
  {
    id: 'q4',
    text: 'Does your project involve a Qualified Scientist (PhD, MD, DVM) at a university, hospital, or government laboratory as your primary research supervisor?',
    required: ['Form 2'],
    note: 'Required when research is conducted at a regulated institution',
  },
  {
    id: 'q5',
    text: 'Is this project a continuation of research you submitted to an ISEF-affiliated fair in a previous competition year?',
    required: ['Form 1B'],
    note: 'New data and procedures from this year must be clearly documented',
  },
  {
    id: 'q6',
    text: 'Does your project involve the collection, use, or analysis of blood, tissue, primary cell cultures, or body fluids from humans or vertebrate animals — including commercially purchased or archived biological samples?',
    required: ['Form 6B'],
    note: 'Applies even if the samples are de-identified or obtained from a repository',
  },
  {
    id: 'q7',
    text: 'Does your project use any electrical components, open flames, high-powered lasers (>5 mW), pressurized systems, or other physical or mechanical hazards not already covered above?',
    required: ['Form 3'],
    note: 'Includes robotics, circuits, combustion engines, and pressure vessels',
  },
  {
    id: 'q8',
    text: 'Will your project be physically displayed at an ISEF-affiliated science fair or competition (backboard, models, or working devices on the exhibit floor)?',
    required: ['Form 7'],
    note: 'Required at the display stage — covers backboard size limits, electrical rules, and prohibited items',
  },
]

/* ================================================================
   UTILITIES
   ================================================================ */

function downloadText(filename, content) {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
  const url  = URL.createObjectURL(blob)
  const a    = Object.assign(document.createElement('a'), { href: url, download: filename })
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

/* ================================================================
   ICONS
   ================================================================ */

const Ico = {
  attendance: (cls) => (
    <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true" focusable="false">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
    </svg>
  ),
  mentor: (cls) => (
    <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true" focusable="false">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  ),
  forms: (cls) => (
    <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true" focusable="false">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  ),
  research: (cls) => (
    <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true" focusable="false">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
    </svg>
  ),
  support: (cls) => (
    <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true" focusable="false">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
    </svg>
  ),
  roster: (cls) => (
    <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true" focusable="false">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M3 10h18M3 14h18M10 4v16M3 4h18a1 1 0 011 1v14a1 1 0 01-1 1H3a1 1 0 01-1-1V5a1 1 0 011-1z" />
    </svg>
  ),
  logout: (cls) => (
    <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true" focusable="false">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
    </svg>
  ),
  check: (cls) => (
    <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true" focusable="false">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
    </svg>
  ),
  x: (cls) => (
    <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true" focusable="false">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  ),
  chevronDown: (cls) => (
    <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true" focusable="false">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
    </svg>
  ),
  upload: (cls) => (
    <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true" focusable="false">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
    </svg>
  ),
  download: (cls) => (
    <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true" focusable="false">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
    </svg>
  ),
  file: (cls) => (
    <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true" focusable="false">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  ),
  location: (cls) => (
    <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true" focusable="false">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  ),
  logo: (cls) => (
    <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true" focusable="false">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
    </svg>
  ),
  export: (cls) => (
    <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true" focusable="false">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M12 10v6m0 0l-3-3m3 3l3-3M3 17V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
    </svg>
  ),
}

/* ================================================================
   SHARED COMPONENTS
   ================================================================ */

function Badge({ status }) {
  const map = {
    'Pending Review':    'bg-amber-50 text-amber-700 border-amber-200',
    'Approved':          'bg-green-50 text-green-700 border-green-200',
    'Changes Requested': 'bg-red-50 text-red-700 border-red-200',
    'Unanswered':        'bg-gray-100 text-gray-600 border-gray-200',
    'Replied':           'bg-green-50 text-green-700 border-green-200',
  }
  const dot = {
    'Pending Review': 'bg-amber-400', 'Approved': 'bg-green-500',
    'Changes Requested': 'bg-red-400', 'Unanswered': 'bg-gray-400', 'Replied': 'bg-green-500',
  }
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium border ${map[status] ?? 'bg-gray-100 text-gray-600 border-gray-200'}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${dot[status] ?? 'bg-gray-400'}`} />
      {status}
    </span>
  )
}

function Spinner({ size = 'md' }) {
  const s = size === 'sm' ? 'w-3.5 h-3.5' : 'w-4 h-4'
  return (
    <svg className={`animate-spin ${s}`} fill="none" viewBox="0 0 24 24">
      <circle className="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-80" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  )
}

function Toast({ message, type = 'success', onClose }) {
  useEffect(() => { const t = setTimeout(onClose, 4500); return () => clearTimeout(t) }, [onClose])
  const styles = { success: 'bg-gray-900 text-white', error: 'bg-red-600 text-white', info: 'bg-gray-700 text-white' }
  return (
    <div className={`fixed top-5 right-5 z-[100] flex items-center gap-3 pl-4 pr-3 py-3 rounded-2xl shadow-2xl max-w-xs animate-slide-in-right ${styles[type]}`}>
      <div className="flex-shrink-0 w-5 h-5 rounded-full bg-white/20 flex items-center justify-center">
        {type === 'success' && Ico.check('w-3 h-3 text-white')}
        {type === 'error'   && Ico.x('w-3 h-3 text-white')}
        {type === 'info'    && <span className="text-xs font-bold">i</span>}
      </div>
      <p className="text-sm font-medium flex-1">{message}</p>
      <button onClick={onClose} className="ml-1 opacity-60 hover:opacity-100 transition">{Ico.x('w-4 h-4')}</button>
    </div>
  )
}

function Modal({ title, onClose, children, wide = false }) {
  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-[2px] flex items-center justify-center z-50 p-4">
      <div className={`bg-white rounded-2xl shadow-2xl ${wide ? 'max-w-2xl' : 'max-w-md'} w-full animate-scale-in`}>
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
          <h3 className="text-base font-semibold text-black">{title}</h3>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-xl hover:bg-gray-100 transition text-gray-400 hover:text-black">
            {Ico.x('w-4 h-4')}
          </button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  )
}

/* ================================================================
   PDF GENERATOR  (text content → valid PDF blob, no library needed)
   ================================================================ */

function createPdfBlob(rawText) {
  // Sanitize to printable ASCII — Courier Type1 font has no Unicode support
  const text = rawText
    .replace(/[━─═]/g, '-')
    .replace(/[✓✔☑]/g, '[x]')
    .replace(/☐/g, '[ ]')
    .replace(/[""«»]/g, '"')
    .replace(/['']/g, "'")
    .replace(/[–—]/g, '-')
    .replace(/…/g, '...')
    .replace(/[^\x09\x0A\x0D\x20-\x7E]/g, '?')

  const PW = 612, PH = 792, MX = 54, MY = 54
  const FS = 9, LH = 13
  const maxChars = 94  // chars per line at Courier 9pt inside margins

  // Word-wrap + split into pages
  const wrapped = []
  for (const raw of text.split('\n')) {
    if (raw.length <= maxChars) { wrapped.push(raw); continue }
    for (let i = 0; i < raw.length; i += maxChars) wrapped.push(raw.slice(i, i + maxChars))
  }
  const lpp = Math.floor((PH - MY * 2) / LH)
  const pages = []
  for (let i = 0; i < wrapped.length; i += lpp) pages.push(wrapped.slice(i, i + lpp))
  if (!pages.length) pages.push([])

  const enc = new TextEncoder()
  const bufs = []
  let pos = 0
  const off = {}

  const emit = (s) => {
    const b = enc.encode(s)
    bufs.push(b)
    pos += b.length
  }

  emit('%PDF-1.4\n')

  // Obj 1 — Catalog
  off[1] = pos
  emit('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n')

  // Obj 2 — Pages
  const nP = pages.length
  const fontN = 3 + nP * 2
  off[2] = pos
  emit(`2 0 obj\n<< /Type /Pages /Kids [${pages.map((_, i) => `${3 + i * 2} 0 R`).join(' ')}] /Count ${nP} >>\nendobj\n`)

  for (let p = 0; p < nP; p++) {
    const pN = 3 + p * 2, cN = 4 + p * 2

    // Content stream: one Tm+Tj per line (absolute positioning)
    const sl = ['BT', `/F1 ${FS} Tf`]
    pages[p].forEach((line, li) => {
      const y = PH - MY - (li + 1) * LH
      const esc = line.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)')
      sl.push(`1 0 0 1 ${MX} ${y} Tm (${esc}) Tj`)
    })
    sl.push('ET')
    const stream = sl.join('\n')
    const streamLen = enc.encode(stream).length + 1  // +1 for trailing \n

    // Page object
    off[pN] = pos
    emit(`${pN} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PW} ${PH}] /Contents ${cN} 0 R /Resources << /Font << /F1 ${fontN} 0 R >> >> >>\nendobj\n`)

    // Content stream object
    off[cN] = pos
    emit(`${cN} 0 obj\n<< /Length ${streamLen} >>\nstream\n`)
    emit(stream + '\n')
    emit('endstream\nendobj\n')
  }

  // Font object — Courier is a standard PDF Type1 font, no embedding needed
  off[fontN] = pos
  emit(`${fontN} 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>\nendobj\n`)

  // Cross-reference table (each entry must be exactly 20 bytes: 10+1+5+1+1+\r\n)
  const xrefPos = pos
  const totalN = fontN + 1
  emit(`xref\n0 ${totalN}\n`)
  emit(`0000000000 65535 f\r\n`)
  for (let i = 1; i < totalN; i++) {
    emit(`${String(off[i]).padStart(10, '0')} 00000 n\r\n`)
  }

  emit(`trailer\n<< /Size ${totalN} /Root 1 0 R >>\nstartxref\n${xrefPos}\n%%EOF\n`)

  const total = bufs.reduce((s, b) => s + b.length, 0)
  const result = new Uint8Array(total)
  let cursor = 0
  for (const b of bufs) { result.set(b, cursor); cursor += b.length }

  return new Blob([result], { type: 'application/pdf' })
}

/* ================================================================
   DOCUMENT VIEWER MODAL
   ================================================================ */

function DocViewerModal({ doc, onClose }) {
  const [pdfUrl, setPdfUrl] = useState(null)
  const content = MOCK_DOC_PREVIEWS[doc.file]

  useEffect(() => {
    let url
    let needRevoke = false
    if (doc.pdfSrc) {
      url = doc.pdfSrc          // public static asset — no objectURL needed
    } else if (doc.fileObj) {
      url = URL.createObjectURL(doc.fileObj)
      needRevoke = true
    } else if (content) {
      url = URL.createObjectURL(createPdfBlob(content))
      needRevoke = true
    }
    if (url) setPdfUrl(url)
    return () => { if (needRevoke && url) URL.revokeObjectURL(url) }
  }, [])  // eslint-disable-line react-hooks/exhaustive-deps

  const handleDownload = () => {
    // Signed storage URLs are cross-origin, where the download attribute is
    // ignored; open the attachment-disposition URL in a new tab instead.
    if (doc.downloadUrl) { window.open(doc.downloadUrl, '_blank', 'noopener'); return }
    if (!pdfUrl) return
    const a = Object.assign(document.createElement('a'), { href: pdfUrl, download: doc.file })
    document.body.appendChild(a); a.click(); document.body.removeChild(a)
  }

  const canPreview = !!(doc.pdfSrc || doc.fileObj || content)

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-[2px] flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl flex flex-col animate-scale-in"
        style={{ height: '90vh' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-100 flex-shrink-0">
          <div className="w-8 h-8 bg-gray-100 rounded-xl flex items-center justify-center flex-shrink-0">
            {Ico.file('w-4 h-4 text-gray-500')}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-black truncate">{doc.file}</p>
            <p className="text-xs text-gray-400">{doc.type} · {doc.date} · {doc.size}</p>
          </div>
          {canPreview && (
            <button
              onClick={handleDownload}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-green-700 text-white rounded-xl text-xs font-semibold hover:bg-green-800 transition flex-shrink-0"
            >
              {Ico.download('w-3.5 h-3.5')} Download PDF
            </button>
          )}
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-gray-100 transition text-gray-400 hover:text-black flex-shrink-0"
          >
            {Ico.x('w-4 h-4')}
          </button>
        </div>

        {/* PDF viewer area */}
        <div className="flex-1 min-h-0 bg-gray-200 rounded-b-2xl overflow-hidden">
          {pdfUrl ? (
            <iframe
              src={pdfUrl}
              className="w-full h-full border-0"
              title={doc.file}
            />
          ) : canPreview ? (
            <div className="w-full h-full flex items-center justify-center text-gray-400 gap-2">
              <Spinner /> <span className="text-sm">Generating PDF…</span>
            </div>
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center gap-3 text-gray-400 px-6 text-center">
              {Ico.file('w-10 h-10')}
              <p className="text-sm font-semibold text-black">Preview unavailable</p>
              <p className="text-xs max-w-xs">This file was uploaded during the session and cannot be previewed here. Re-upload to view.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/* ================================================================
   PUBLIC HOMEPAGE
   ================================================================ */

const BOARD_MEMBERS = [
  { role: 'President',       name: 'Andreas Hoimes',   email: 'aphoimes@students.wcpss.net' },
  { role: 'Vice President',  name: 'Jacob Michael',    email: 'jsmichael@students.wcpss.net' },
  { role: 'Director of Competition', name: 'Nehala Chandolu', email: 'nchandolu@students.wcpss.net' },
  { role: 'Director of Research',    name: 'Saumit Rampalli', email: 'srampalli@students.wcpss.net' },
  { role: 'Director of Research Integrity & School Connections', name: 'Adarsh Senthurkumaran', email: 'asenthurkumaran@students.wcpss.net' },
  { role: 'Director of Outreach & Community Service', name: 'Maithili Kodali',        email: 'mkodali2@students.wcpss.net' },
  { role: 'Director of Outreach & Community Service', name: 'Vivek Chandra Chintala', email: 'vchintala@students.wcpss.net' },
  { role: 'Director of Outreach & Community Service', name: 'Sribala Arunachalam',    email: 'sarunachalam@students.wcpss.net' },
  { role: 'Director of Organization & Publicity', name: 'Myra Bhagat', email: 'mbhagat@students.wcpss.net' },
  { role: 'Director of Organization & Publicity', name: 'Gio Sayde',   email: 'gsayde@students.wcpss.net' },
]

const ADVISORS = [
  { role: 'Faculty Advisor', name: '[Advisor Name]', email: 'advisor@wcpss.net' },
]

const HOME_PROGRAMS = [
  { title: 'Meeting presentations', desc: 'At each meeting an officer presents one part of the research process: forming a question, reviewing literature, designing an experiment, analyzing data, writing it up. Slides stay available to members afterward.' },
  { title: 'Project mentorship', desc: 'Members can work with a mentor experienced in their field, and first-time researchers are paired with members who have been through a competition season already.' },
  { title: 'Research paperwork help', desc: 'Science fair projects require regulatory forms, and some categories (human subjects, vertebrate animals, biohazards) require approval before you start. The club walks you through which forms apply and reviews them before submission.' },
  { title: 'Summer program listings', desc: 'We keep a running list of research internships and university summer programs open to high schoolers, with deadlines.' },
]

const HOME_COMPETITIONS = [
  { name: 'NCSEF', full: 'North Carolina Science and Engineering Fair', when: 'February and March', detail: 'Our region is 3A. Projects that place at regionals advance to the state fair in Raleigh, and top state finishers can qualify for the international fair (ISEF).' },
  { name: 'NCSAS', full: 'North Carolina Student Academy of Science', when: 'March', detail: 'A paper-and-presentation format: you submit a written paper and defend it in a talk before judges.' },
  { name: 'Regeneron STS', full: 'Regeneron Science Talent Search', when: 'Application due in the fall', detail: 'A national, paper-based competition for seniors with an original research project.' },
]

function MediaPlaceholder({ label = 'Photo coming soon', className = '' }) {
  return (
    <div className={`relative overflow-hidden rounded-xl border border-gray-200 bg-gray-100 flex flex-col items-center justify-center gap-2 ${className}`}>
      <svg className="w-7 h-7 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true" focusable="false">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
      {label && <p className="text-xs text-gray-500">{label}</p>}
    </div>
  )
}

const HOME_SEASON = [
  { when: 'February',    what: 'NCSEF Region 3A fair' },
  { when: 'March',       what: 'NCSEF state fair, Raleigh' },
  { when: 'March',       what: 'NCSAS paper presentations' },
  { when: 'May',         what: 'Regeneron ISEF (state qualifiers)' },
  { when: 'End of year', what: 'Green Level Journal published' },
]

const HOME_JOIN_STEPS = [
  { n: 1, title: 'Apply in the fall', desc: 'The application is announced in the daily announcements and on Instagram at the start of the school year.' },
  { n: 2, title: 'Pick a question', desc: 'Early meetings cover how to turn a topic you care about into a question you can actually test.' },
  { n: 3, title: 'Run the project', desc: 'Work independently or with a group. Mentors and officers help with design, materials, and the regulatory forms.' },
  { n: 4, title: 'Compete or publish', desc: 'Enter NCSEF or NCSAS in the spring, and publish your write-up in the journal either way.' },
]

function HomePage({ onLoginClick, signedIn = false }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const loginLabel = signedIn ? 'Open Portal' : 'Member Login'
  const navLinks = [
    { href: '#about',        label: 'About' },
    { href: '#projects',     label: 'Projects & Service' },
    { href: '#journal',      label: 'Journal' },
    { href: '#competitions', label: 'Competitions' },
    { href: '#officers',     label: 'Officers' },
    { href: '#contact',      label: 'Contact' },
  ]

  return (
    <div className="min-h-screen bg-white text-black antialiased">
      {/* ---------- TOP BAR ---------- */}
      <div className="bg-blue-950 text-blue-200">
        <div className="max-w-6xl mx-auto px-6 sm:px-10 h-9 flex items-center justify-between text-xs">
          <p className="truncate">Green Level High School · Cary, NC</p>
          <div className="flex items-center gap-5 flex-shrink-0">
            <a href="https://www.instagram.com/glstemrc" target="_blank" rel="noreferrer" className="hover:text-white transition">@glstemrc</a>
            <button onClick={onLoginClick} className="hover:text-white transition font-semibold">{loginLabel}</button>
          </div>
        </div>
      </div>

      {/* ---------- NAV ---------- */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-6 sm:px-10 h-16 flex items-center justify-between gap-4">
          <a href="#top" className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 bg-blue-950 rounded-lg flex items-center justify-center flex-shrink-0">
              {Ico.logo('w-5 h-5 text-white')}
            </div>
            <div className="leading-tight">
              <p className="text-sm font-bold tracking-tight text-blue-950">STEM Research Club</p>
              <p className="text-[11px] text-gray-500">Green Level High School</p>
            </div>
          </a>
          <nav className="hidden lg:flex items-center gap-7">
            {navLinks.map(l => (
              <a key={l.href} href={l.href}
                className="text-sm text-gray-600 hover:text-blue-950 transition">
                {l.label}
              </a>
            ))}
          </nav>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button onClick={onLoginClick}
              className="bg-green-700 text-white px-4 py-2 rounded-md text-sm font-semibold hover:bg-green-800 transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green-700">
              {loginLabel}
            </button>
            <button onClick={() => setMenuOpen(o => !o)} aria-label={menuOpen ? 'Close menu' : 'Open menu'} aria-expanded={menuOpen}
              className="lg:hidden w-10 h-10 flex items-center justify-center rounded-md text-blue-950 hover:bg-gray-100 transition">
              {menuOpen ? Ico.x('w-5 h-5') : (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true" focusable="false">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              )}
            </button>
          </div>
        </div>
        {menuOpen && (
          <nav className="lg:hidden border-t border-gray-200 bg-white px-6 py-3 animate-fade-in">
            {navLinks.map(l => (
              <a key={l.href} href={l.href} onClick={() => setMenuOpen(false)}
                className="block py-2.5 text-sm font-medium text-gray-700 hover:text-blue-950 transition">
                {l.label}
              </a>
            ))}
          </nav>
        )}
      </header>

      <main>
      {/* ---------- HERO ---------- */}
      <section id="top" className="bg-blue-950 text-white">
        <div className="max-w-6xl mx-auto px-6 sm:px-10 py-14 sm:py-20 grid lg:grid-cols-[1.15fr_0.85fr] gap-12 lg:gap-16 items-start">
          <div>
            <h1 className="text-4xl sm:text-5xl font-bold leading-[1.08] tracking-tight">
              Attend our biweekly meetings to learn how to research.
            </h1>
            <p className="mt-6 text-lg text-blue-100 leading-relaxed max-w-xl">
              STEMRC members design and run their own research projects and inventions, on
              almost any topic, and enter them in North Carolina's science fairs. No prior
              research experience is expected.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <button onClick={onLoginClick}
                className="bg-green-700 text-white px-6 py-3 rounded-md text-sm font-semibold hover:bg-green-600 transition">
                {loginLabel}
              </button>
              <a href="#join"
                className="px-6 py-3 rounded-md text-sm font-semibold border border-white/25 text-white hover:border-white transition">
                How joining works
              </a>
            </div>
            <dl className="mt-12 grid sm:grid-cols-3 gap-6 max-w-xl">
              {[
                ['Meetings', 'Every other week, room posted each semester'],
                ['Who can join', 'All grades, every STEM discipline'],
                ['Workload', 'About 45 minutes a week outside meetings'],
              ].map(([term, def]) => (
                <div key={term} className="border-t-2 border-green-500 pt-3">
                  <dt className="text-sm font-bold text-white">{term}</dt>
                  <dd className="mt-1 text-sm text-blue-200 leading-snug">{def}</dd>
                </div>
              ))}
            </dl>
          </div>

          <div className="bg-white text-black rounded-2xl p-7 sm:p-8 shadow-xl shadow-blue-900/30">
            <h2 className="text-lg font-bold text-blue-950">The season ahead</h2>
            <p className="mt-1 text-sm text-gray-500">Exact dates firm up at fall meetings.</p>
            <ul className="mt-6 divide-y divide-gray-100">
              {HOME_SEASON.map((s, i) => (
                <li key={i} className="py-3 flex items-baseline gap-4">
                  <span className="text-xs font-bold text-green-700 uppercase w-24 flex-shrink-0">{s.when}</span>
                  <span className="text-sm text-gray-700">{s.what}</span>
                </li>
              ))}
            </ul>
            <a href="#competitions" className="mt-5 inline-block text-sm font-semibold text-green-700 hover:text-green-800 transition underline underline-offset-4 decoration-green-700/30">
              More on each competition
            </a>
          </div>
        </div>
      </section>

      {/* ---------- PHOTO STRIP ---------- */}
      <section className="border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-6 sm:px-10 py-10">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <MediaPlaceholder label="Club meeting" className="aspect-[4/3] md:col-span-2 md:aspect-auto" />
            <MediaPlaceholder label="Fair day" className="aspect-[4/3]" />
            <MediaPlaceholder label="Outreach event" className="aspect-[4/3]" />
          </div>
        </div>
      </section>

      {/* ---------- ABOUT ---------- */}
      <section id="about" className="scroll-mt-20 border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-6 sm:px-10 py-14 sm:py-20 grid lg:grid-cols-[1.1fr_0.9fr] gap-12 lg:gap-16 items-center">
          <div>
            <h2 className="text-2xl sm:text-3xl font-bold text-blue-950 tracking-tight">About the club</h2>
            <p className="mt-5 text-gray-600 leading-relaxed">
              Science fair research has a lot of moving parts: picking a question worth asking,
              designing an experiment, getting regulatory approval for certain project types,
              collecting and analyzing data, and presenting to judges. Meetings cover one of
              these at a time, so a member who starts in the fall has walked through the whole
              process by the time regional fairs arrive in February.
            </p>
            <p className="mt-4 text-gray-600 leading-relaxed">
              Projects come from every discipline. Recent seasons have included machine
              learning models, engineered devices, and behavioral studies. The club is open to
              all grades, and members who finish a project can publish a write-up in the
              Green Level Journal at the end of the year.
            </p>
            <p className="mt-4 text-gray-600 leading-relaxed">
              The time commitment is around 45 minutes a week outside of meetings. Deadlines
              are flexible; what matters is steady progress on your project over the year and
              running it ethically.
            </p>
          </div>
          <MediaPlaceholder label="Meeting photo" className="aspect-[4/3]" />
        </div>
      </section>

      {/* ---------- WHAT THE CLUB DOES ---------- */}
      <section className="bg-green-50/60 border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-6 sm:px-10 py-14 sm:py-20">
          <h2 className="text-2xl sm:text-3xl font-bold text-blue-950 tracking-tight">What the club does</h2>
          <p className="mt-4 text-gray-600 leading-relaxed max-w-2xl">
            The biweekly meeting is the core of the club; everything else runs alongside it.
            Slides and materials from every presentation stay available to members in the portal.
          </p>
          <div className="mt-8 grid md:grid-cols-2 gap-5">
            {HOME_PROGRAMS.map(p => (
              <div key={p.title} className="bg-white border border-gray-200 rounded-xl p-6">
                <h3 className="text-base font-bold text-blue-950">{p.title}</h3>
                <p className="mt-2 text-[15px] text-gray-600 leading-relaxed">{p.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- HOW JOINING WORKS ---------- */}
      <section id="join" className="scroll-mt-20 border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-6 sm:px-10 py-14 sm:py-20">
          <div className="max-w-2xl">
            <h2 className="text-2xl sm:text-3xl font-bold text-blue-950 tracking-tight">How joining works</h2>
            <p className="mt-4 text-gray-600 leading-relaxed">
              Membership is by application, once a year. Accepted members get a portal account
              and meeting details.
            </p>
          </div>
          <ol className="mt-10 grid sm:grid-cols-2 lg:grid-cols-4 gap-x-8 gap-y-10">
            {HOME_JOIN_STEPS.map(step => (
              <li key={step.n}>
                <div className="w-9 h-9 rounded-full bg-blue-950 text-white flex items-center justify-center text-sm font-bold">
                  {step.n}
                </div>
                <h3 className="mt-4 text-base font-bold text-blue-950">{step.title}</h3>
                <p className="mt-2 text-sm text-gray-600 leading-relaxed">{step.desc}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ---------- PROJECTS & SERVICE ---------- */}
      <section id="projects" className="scroll-mt-20 bg-gray-50 border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-6 sm:px-10 py-14 sm:py-20">
          <h2 className="text-2xl sm:text-3xl font-bold text-blue-950 tracking-tight">Projects &amp; service</h2>
          <div className="mt-8 grid lg:grid-cols-2 gap-10 lg:gap-16">
            <div>
              <h3 className="text-lg font-bold text-blue-950">Member projects</h3>
              <p className="mt-3 text-gray-600 leading-relaxed">
                Research is done independently or with a group of peers in the club, on a topic
                you pick. Many members use their project to explore a field they are considering
                for college or a career. Projects can be entered in competitions, published in
                the journal, or simply finished for their own sake.
              </p>
              <div className="grid grid-cols-2 gap-4 mt-6">
                <MediaPlaceholder label="Project photo" className="aspect-[4/3] bg-white" />
                <MediaPlaceholder label="Project photo" className="aspect-[4/3] bg-white" />
              </div>
            </div>
            <div>
              <h3 className="text-lg font-bold text-blue-950">Outreach and community service</h3>
              <p className="mt-3 text-gray-600 leading-relaxed">
                The club also runs outreach and service events in the school and the wider
                community, organized by our three Directors of Outreach &amp; Community Service.
                Details for the current year's events are announced at meetings and on Instagram.
              </p>
              <MediaPlaceholder label="Service event photo" className="mt-6 aspect-[16/7] bg-white" />
            </div>
          </div>
        </div>
      </section>

      {/* ---------- GREEN LEVEL JOURNAL ---------- */}
      <section id="journal" className="scroll-mt-20 border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-6 sm:px-10 py-14 sm:py-20 grid lg:grid-cols-[1fr_320px] gap-12 lg:gap-20 items-center">
          <div>
            <h2 className="text-2xl sm:text-3xl font-bold text-blue-950 tracking-tight">The Green Level Journal</h2>
            <p className="mt-5 text-gray-600 leading-relaxed">
              The club publishes a school research journal at the end of each year, containing
              members' thesis papers and research projects. Publishing is open to any member
              with completed work; your project does not have to have competed anywhere to be
              included.
            </p>
            <p className="mt-4 text-gray-600 leading-relaxed">
              The journal is edited and produced by students. If you want to be involved on the
              editing side rather than as an author, talk to the Director of Research at a meeting.
            </p>
          </div>
          <MediaPlaceholder label="Journal cover" className="aspect-[3/4]" />
        </div>
      </section>

      {/* ---------- COMPETITIONS ---------- */}
      <section id="competitions" className="scroll-mt-20 bg-green-50/60 border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-6 sm:px-10 py-14 sm:py-20">
          <h2 className="text-2xl sm:text-3xl font-bold text-blue-950 tracking-tight">Where we compete</h2>
          <p className="mt-4 text-gray-600 leading-relaxed max-w-2xl">
            Exact dates change each year and are announced at fall meetings.
          </p>
          <div className="mt-8 grid md:grid-cols-3 gap-5">
            {HOME_COMPETITIONS.map(c => (
              <div key={c.name} className="bg-white border border-gray-200 rounded-xl p-6 flex flex-col">
                <h3 className="text-lg font-bold text-blue-950">{c.name}</h3>
                <p className="text-sm text-gray-500 mt-0.5">{c.full}</p>
                <p className="mt-3 text-[15px] text-gray-600 leading-relaxed flex-1">{c.detail}</p>
                <p className="mt-4 pt-4 border-t border-gray-100 text-sm font-semibold text-green-700">{c.when}</p>
              </div>
            ))}
          </div>
          <div className="mt-8 bg-white border border-gray-200 rounded-xl px-6 py-5 flex flex-wrap items-center gap-x-8 gap-y-2">
            <p className="text-sm font-bold text-blue-950">Helpful links</p>
            {[
              ['NCSEF', 'https://ncsef.org'],
              ['NCSAS', 'https://ncsas.org'],
              ['ISEF rules & forms', 'https://www.societyforscience.org/isef/'],
              ['Our Instagram', 'https://www.instagram.com/glstemrc'],
            ].map(([label, href]) => (
              <a key={label} href={href} target="_blank" rel="noreferrer"
                className="text-sm text-green-700 font-semibold hover:text-green-800 transition underline underline-offset-4 decoration-green-700/30">
                {label}
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- MEMBER PORTAL ---------- */}
      <section className="bg-blue-950 text-white">
        <div className="max-w-6xl mx-auto px-6 sm:px-10 py-14 sm:py-20 grid lg:grid-cols-[1fr_1fr] gap-12 lg:gap-16 items-center">
          <div>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">The member portal</h2>
            <p className="mt-5 text-blue-100 leading-relaxed">
              Members run the club through this site. Once accepted, create your account
              with your school email and you're in.
            </p>
            <button onClick={onLoginClick}
              className="mt-7 bg-white text-blue-950 px-6 py-3 rounded-md text-sm font-semibold hover:bg-blue-50 transition">
              {signedIn ? 'Open Portal' : 'Sign in or create an account'}
            </button>
          </div>
          <div className="grid sm:grid-cols-2 gap-x-8 gap-y-7">
            {[
              ['Meeting check-in', 'Log attendance with the code written on the board at each meeting.'],
              ['ISEF forms wizard', 'Eight questions tell you which of the 18 official regulatory forms your project needs, with the PDFs to download.'],
              ['Document review', 'Upload forms and research plans; officers review and send feedback.'],
              ['Shifts and questions', 'Sign up for mentoring shifts and file questions for the board.'],
            ].map(([t, d]) => (
              <div key={t} className="border-t border-white/15 pt-4">
                <h3 className="text-sm font-bold">{t}</h3>
                <p className="mt-1.5 text-sm text-blue-200 leading-relaxed">{d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- OFFICERS ---------- */}
      <section id="officers" className="scroll-mt-20 border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-6 sm:px-10 py-14 sm:py-20">
          <h2 className="text-2xl sm:text-3xl font-bold text-blue-950 tracking-tight">Officers and advisor</h2>
          <p className="mt-4 text-gray-600 leading-relaxed max-w-2xl">
            Our 2026–27 roster is coming soon. The board below is from the 2025–26 school year.
          </p>
          <div className="mt-8 grid md:grid-cols-2 gap-x-12 divide-y md:divide-y-0 border-t border-gray-200 md:border-t-0">
            <div className="divide-y divide-gray-200 md:border-t md:border-b md:border-gray-200">
              {[...BOARD_MEMBERS.slice(0, 5)].map(m => (
                <div key={m.email} className="py-4 flex items-center gap-4">
                  <div className="w-11 h-11 rounded-full bg-blue-950 text-white flex items-center justify-center text-xs font-bold flex-shrink-0">
                    {m.name.startsWith('[') ? '?' : initialsOf(m.name)}
                  </div>
                  <div className="min-w-0">
                    <p className="text-[15px] font-semibold text-blue-950">{m.name}</p>
                    <p className="text-sm text-gray-500">{m.role}</p>
                    <a href={`mailto:${m.email}`} className="text-xs text-gray-500 hover:text-green-700 transition truncate block">{m.email}</a>
                  </div>
                </div>
              ))}
            </div>
            <div className="divide-y divide-gray-200 md:border-t md:border-b md:border-gray-200">
              {[...BOARD_MEMBERS.slice(5), ...ADVISORS].map(m => (
                <div key={m.email} className="py-4 flex items-center gap-4">
                  <div className="w-11 h-11 rounded-full bg-blue-950 text-white flex items-center justify-center text-xs font-bold flex-shrink-0">
                    {m.name.startsWith('[') ? '?' : initialsOf(m.name)}
                  </div>
                  <div className="min-w-0">
                    <p className="text-[15px] font-semibold text-blue-950">{m.name}</p>
                    <p className="text-sm text-gray-500">{m.role}</p>
                    <a href={`mailto:${m.email}`} className="text-xs text-gray-500 hover:text-green-700 transition truncate block">{m.email}</a>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ---------- CONTACT ---------- */}
      <section id="contact" className="scroll-mt-20 bg-gray-50">
        <div className="max-w-6xl mx-auto px-6 sm:px-10 py-14 sm:py-20 grid lg:grid-cols-[1.1fr_0.9fr] gap-12 lg:gap-16">
          <div>
            <h2 className="text-2xl sm:text-3xl font-bold text-blue-950 tracking-tight">Contact</h2>
            <p className="mt-5 text-gray-600 leading-relaxed max-w-xl">
              Membership is by application. The application opens at the start of the school
              year and is announced in the school's daily announcements and on Instagram.
              Accepted members receive meeting details and a portal account.
            </p>
            <p className="mt-4 text-gray-600 leading-relaxed max-w-xl">
              Green Level High School, Cary, North Carolina.
            </p>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl p-7 self-start">
            <h3 className="text-base font-bold text-blue-950">Reach us</h3>
            <div className="mt-4 space-y-3 text-sm">
              <p className="text-gray-600">
                Instagram:{' '}
                <a href="https://www.instagram.com/glstemrc" target="_blank" rel="noreferrer"
                  className="text-green-700 font-semibold hover:text-green-800 transition">@glstemrc</a>
              </p>
              <p className="text-gray-600">
                Questions about applying:{' '}
                <a href="mailto:jsmichael@students.wcpss.net"
                  className="text-green-700 font-semibold hover:text-green-800 transition break-all">jsmichael@students.wcpss.net</a>
              </p>
              <p className="text-gray-600">Or email any officer listed above.</p>
            </div>
          </div>
        </div>
      </section>

      </main>

      {/* ---------- FOOTER ---------- */}
      <footer className="bg-blue-950 text-blue-200">
        <div className="max-w-6xl mx-auto px-6 sm:px-10 py-12 grid sm:grid-cols-3 gap-10">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 bg-white/10 rounded-lg flex items-center justify-center">
                {Ico.logo('w-4 h-4 text-white')}
              </div>
              <p className="text-sm font-bold text-white">STEM Research Club</p>
            </div>
            <p className="mt-3 text-sm leading-relaxed">
              <a href="https://www.wcpss.net/greenlevelhs" target="_blank" rel="noreferrer" className="hover:text-white transition underline underline-offset-4 decoration-blue-300/40">Green Level High School</a>
              <br />Cary, North Carolina
            </p>
          </div>
          <div>
            <p className="text-sm font-bold text-white">Site</p>
            <div className="mt-3 space-y-2 text-sm">
              <a href="#about" className="block hover:text-white transition">About</a>
              <a href="#competitions" className="block hover:text-white transition">Competitions</a>
              <a href="#journal" className="block hover:text-white transition">Journal</a>
              <button onClick={onLoginClick} className="block hover:text-white transition">{loginLabel}</button>
            </div>
          </div>
          <div>
            <p className="text-sm font-bold text-white">Elsewhere</p>
            <div className="mt-3 space-y-2 text-sm">
              <a href="https://www.instagram.com/glstemrc" target="_blank" rel="noreferrer" className="block hover:text-white transition">Instagram, @glstemrc</a>
              <a href="mailto:jsmichael@students.wcpss.net" className="block hover:text-white transition">Email the board</a>
            </div>
          </div>
        </div>
        <div className="border-t border-white/10">
          <div className="max-w-6xl mx-auto px-6 sm:px-10 py-5">
            <p className="text-xs text-blue-300">© {new Date().getFullYear()} STEM Research Club at Green Level High School. Site built and maintained by club members.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}

/* ================================================================
   LOGIN PAGE
   ================================================================ */

function LoginPage({ onBack }) {
  const [mode, setMode]         = useState('signin')   // 'signin' | 'signup'
  const [name, setName]         = useState('')
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState('')
  const [notice, setNotice]     = useState('')
  const [loading, setLoading]   = useState(false)

  const switchMode = (m) => { setMode(m); setError(''); setNotice('') }

  const submit = useCallback(async (e) => {
    if (e) e.preventDefault()
    setLoading(true); setError(''); setNotice('')

    if (mode === 'signin') {
      const { error: authError } = await supabase.auth.signInWithPassword({ email, password })
      if (authError) {
        setError(authError.message === 'Invalid login credentials'
          ? 'Incorrect email or password.'
          : authError.message)
        setLoading(false)
      }
      // On success the auth listener in App switches to the portal.
      return
    }

    // Sign up — new accounts are students by default.
    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      setLoading(false)
      return
    }
    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { name: name.trim() } },
    })
    if (signUpError) {
      setError(signUpError.message.includes('already registered')
        ? 'An account with this email already exists. Sign in instead.'
        : signUpError.message)
      setLoading(false)
      return
    }
    if (data.session) {
      // Signed up and signed in; the auth listener takes it from here.
      return
    }
    setNotice('Account created. Check your email to confirm it, then sign in.')
    setMode('signin')
    setLoading(false)
  }, [mode, name, email, password])

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
      {onBack && (
        <button onClick={onBack}
          className="fixed top-5 left-5 flex items-center gap-2 text-sm font-medium text-gray-500 hover:text-black transition px-3 py-2 rounded-xl hover:bg-gray-100">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 17l-5-5m0 0l5-5m-5 5h12" />
          </svg>
          Back to homepage
        </button>
      )}
      <div className="w-full max-w-[420px]">
        <div className="text-center mb-8 animate-fade-in">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-blue-950 rounded-2xl mb-5 shadow-lg">
            {Ico.logo('w-7 h-7 text-white')}
          </div>
          <h1 className="text-[22px] font-bold text-blue-950 tracking-tight">STEM Research Club</h1>
          <p className="text-sm text-gray-400 mt-1">Member Portal · Green Level High School</p>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8 animate-fade-in">
          <div className="flex gap-1 bg-gray-100 rounded-lg p-1 mb-6">
            {[['signin', 'Sign In'], ['signup', 'Create Account']].map(([m, label]) => (
              <button key={m} type="button" onClick={() => switchMode(m)}
                className={`flex-1 py-2 rounded-md text-sm font-semibold transition ${mode === m ? 'bg-white text-blue-950 shadow-sm' : 'text-gray-500 hover:text-black'}`}>
                {label}
              </button>
            ))}
          </div>

          {error && (
            <div className="mb-5 flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl p-3.5">
              {Ico.x('w-4 h-4 text-red-500 mt-0.5 flex-shrink-0')}
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}
          {notice && (
            <div className="mb-5 flex items-start gap-3 bg-green-50 border border-green-200 rounded-xl p-3.5">
              {Ico.check('w-4 h-4 text-green-600 mt-0.5 flex-shrink-0')}
              <p className="text-sm text-green-800">{notice}</p>
            </div>
          )}

          <form onSubmit={submit} className="space-y-4">
            {mode === 'signup' && (
              <div>
                <label htmlFor="auth-name" className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">Full Name</label>
                <input id="auth-name" type="text" value={name} onChange={e => setName(e.target.value)} placeholder="First and last name"
                  autoComplete="name"
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm text-black placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-600 focus:border-transparent transition" required />
              </div>
            )}
            <div>
              <label htmlFor="auth-email" className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">School Email</label>
              <input id="auth-email" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@students.wcpss.net"
                autoComplete="email"
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm text-black placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-600 focus:border-transparent transition" required />
            </div>
            <div>
              <label htmlFor="auth-password" className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">Password</label>
              <input id="auth-password" type="password" value={password} onChange={e => setPassword(e.target.value)}
                placeholder={mode === 'signup' ? 'At least 8 characters' : '••••••••••'}
                autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                minLength={mode === 'signup' ? 8 : undefined}
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm text-black placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-600 focus:border-transparent transition" required />
            </div>
            <button type="submit" disabled={loading}
              className="w-full bg-green-700 text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-green-800 transition disabled:opacity-50 flex items-center justify-center gap-2 mt-1">
              {loading ? <><Spinner /> {mode === 'signin' ? 'Signing in…' : 'Creating account…'}</> : (mode === 'signin' ? 'Sign In' : 'Create Account')}
            </button>
          </form>

          <p className="mt-6 text-xs text-gray-500 text-center">
            {mode === 'signin'
              ? 'New member? Create an account with your school email. Forgot your password? Ask an officer at a meeting to reset it.'
              : 'New accounts join as students. Officers are given admin access by the board.'}
          </p>
        </div>
        <p className="text-center text-[11px] text-gray-400 mt-6">STEM Research Club · Green Level High School · Cary, NC</p>
      </div>
    </div>
  )
}

/* ================================================================
   SIDEBAR
   ================================================================ */

function Sidebar({ activeTab, setActiveTab, user, activeRole, onLogout, onHome }) {
  const [mobileOpen, setMobileOpen] = useState(false)
  const pickTab = (id) => { setActiveTab(id); setMobileOpen(false) }
  const navItems = [
    { id: 'attendance', label: 'Attendance',     iconKey: 'attendance' },
    { id: 'mentor',     label: 'Mentor Sign-Up', iconKey: 'mentor'     },
    { id: 'forms',      label: 'ISEF Forms',     iconKey: 'forms'      },
    { id: 'research',   label: 'Research Hub',   iconKey: 'research'   },
    { id: 'support',    label: 'Questions',       iconKey: 'support'    },
    ...(activeRole === 'admin' ? [{ id: 'roster', label: 'Club Roster', iconKey: 'roster' }] : []),
  ]

  return (
    <>
    {/* Mobile top bar */}
    <div className="md:hidden bg-blue-950 sticky top-0 z-40">
      <div className="h-14 px-4 flex items-center justify-between">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-7 h-7 bg-white/10 rounded-lg flex items-center justify-center flex-shrink-0">
            {Ico.logo('w-4 h-4 text-white')}
          </div>
          <p className="text-sm font-bold text-white truncate">STEM Research Club</p>
        </div>
        <button onClick={() => setMobileOpen(o => !o)} aria-label={mobileOpen ? 'Close menu' : 'Open menu'} aria-expanded={mobileOpen}
          className="w-9 h-9 flex items-center justify-center rounded-lg text-white hover:bg-white/10 transition">
          {mobileOpen ? Ico.x('w-5 h-5') : (
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true" focusable="false">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          )}
        </button>
      </div>
      {mobileOpen && (
        <nav className="px-3 pb-3 border-t border-white/10 animate-fade-in">
          <div className="py-2 flex items-center gap-2.5 px-3">
            <div className="w-6 h-6 rounded-full bg-green-700 text-white flex items-center justify-center text-[10px] font-bold flex-shrink-0">{user.initials}</div>
            <p className="text-xs text-blue-200 truncate">{user.name} · <span className="capitalize">{activeRole}</span></p>
          </div>
          {navItems.map(item => (
            <button key={item.id} onClick={() => pickTab(item.id)}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition ${activeTab === item.id ? 'bg-green-700 text-white' : 'text-blue-200 hover:bg-white/5 hover:text-white'}`}>
              {Ico[item.iconKey]('w-4 h-4 flex-shrink-0')}
              {item.label}
            </button>
          ))}
          <div className="mt-1 pt-1 border-t border-white/10">
            <button onClick={onHome}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm text-blue-200 hover:bg-white/5 hover:text-white transition">
              {Ico.location('w-4 h-4 flex-shrink-0')} View Homepage
            </button>
            <button onClick={onLogout}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm text-blue-200 hover:bg-white/5 hover:text-white transition">
              {Ico.logout('w-4 h-4 flex-shrink-0')} Sign Out
            </button>
          </div>
        </nav>
      )}
    </div>

    {/* Desktop sidebar */}
    <aside className="hidden md:flex w-60 min-h-screen bg-blue-950 flex-col flex-shrink-0">
      <button onClick={onHome} className="px-5 py-5 border-b border-white/10 text-left hover:bg-white/5 transition">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-white/10 rounded-xl flex items-center justify-center flex-shrink-0">
            {Ico.logo('w-4 h-4 text-white')}
          </div>
          <div>
            <p className="text-sm font-bold text-white leading-tight">STEM Research Club</p>
            <p className="text-[11px] text-blue-300">Member Portal</p>
          </div>
        </div>
      </button>

      <div className="px-4 py-3.5 border-b border-white/10">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-full bg-green-700 text-white flex items-center justify-center text-[11px] font-bold flex-shrink-0">
            {user.initials}
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-white truncate">{user.name}</p>
            <p className="text-[11px] text-blue-300 capitalize">{activeRole} account</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 px-3 py-3 space-y-0.5">
        {navItems.map(item => {
          const active = activeTab === item.id
          return (
            <button key={item.id} onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${active ? 'bg-green-700 text-white' : 'text-blue-200 hover:bg-white/5 hover:text-white'}`}>
              {Ico[item.iconKey](`w-4 h-4 flex-shrink-0 ${active ? 'text-white' : 'text-blue-300'}`)}
              {item.label}
            </button>
          )
        })}
      </nav>

      <div className="px-3 py-4 border-t border-white/10 space-y-0.5">
        <button onClick={onHome}
          className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm text-blue-200 hover:bg-white/5 hover:text-white transition">
          {Ico.location('w-4 h-4 flex-shrink-0')}
          View Homepage
        </button>
        <button onClick={onLogout}
          className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm text-blue-200 hover:bg-white/5 hover:text-white transition">
          {Ico.logout('w-4 h-4 flex-shrink-0')}
          Sign Out
        </button>
      </div>
    </aside>
    </>
  )
}

/* ================================================================
   TAB 1 — ATTENDANCE
   ================================================================ */

function AttendanceTab({ user }) {
  const today    = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  const todayISO = localISODate()

  const [code, setCode]         = useState('')
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')
  const [toast, setToast]       = useState(null)
  const [myLogs, setMyLogs]     = useState([])
  const [fetchFailed, setFetchFailed] = useState(false)
  const [todayCode, setTodayCode] = useState('')   // admin: current code for today
  const [savingCode, setSavingCode] = useState(false)
  const [recentCodes, setRecentCodes] = useState([])

  const fetchLogs = useCallback(async () => {
    const { data, error: fetchError } = await supabase
      .from('attendance_logs')
      .select('id, date, created_at')
      .eq('user_id', user.id)
      .order('date', { ascending: false })
    setFetchFailed(!!fetchError)
    setMyLogs(data ?? [])
  }, [user.id])

  useEffect(() => { fetchLogs() }, [fetchLogs])

  const fetchCodes = useCallback(async () => {
    if (user.role !== 'admin') return
    const { data } = await supabase
      .from('attendance_codes')
      .select('date, code')
      .order('date', { ascending: false })
      .limit(8)
    setRecentCodes(data ?? [])
    const todayRow = (data ?? []).find(c => c.date === todayISO)
    if (todayRow) setTodayCode(todayRow.code)
  }, [user.role, todayISO])

  useEffect(() => { fetchCodes() }, [fetchCodes])

  const deleteCode = async (date) => {
    const { error: delError } = await supabase.from('attendance_codes').delete().eq('date', date)
    if (delError) {
      setToast({ message: 'Could not delete the code.', type: 'error' })
    } else {
      setToast({ message: `Code for ${fmtDate(date)} deleted. It no longer counts as a meeting in the roster.`, type: 'info' })
      if (date === todayISO) setTodayCode('')
      fetchCodes()
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault(); setError(''); setLoading(true)
    const { data, error: rpcError } = await supabase.rpc('log_attendance', { p_code: code.trim() })
    if (rpcError) {
      setError('Something went wrong. Try again, or ask an officer.')
    } else if (!data.ok) {
      setError(data.error)
    } else {
      setToast({ message: 'Attendance logged successfully!', type: 'success' })
      setCode('')
      fetchLogs()
    }
    setLoading(false)
  }

  const saveTodayCode = async (e) => {
    e.preventDefault()
    if (!todayCode.trim()) return
    setSavingCode(true)
    const { error: upsertError } = await supabase
      .from('attendance_codes')
      .upsert({ date: todayISO, code: todayCode.trim().toUpperCase(), created_by: user.id })
    setToast(upsertError
      ? { message: 'Could not save the code.', type: 'error' }
      : { message: `Today's code is set to ${todayCode.trim().toUpperCase()}.`, type: 'success' })
    if (!upsertError) fetchCodes()
    setSavingCode(false)
  }

  return (
    <div className="max-w-2xl animate-fade-in">
      {toast && <Toast {...toast} onClose={() => setToast(null)} />}

      <div className="mb-7">
        <h2 className="text-2xl font-bold text-black">Attendance</h2>
        <p className="text-sm text-gray-500 mt-1">Log your presence for today's club meeting</p>
      </div>

      {user.role === 'admin' && (
        <div className="bg-white rounded-2xl border border-gray-200 p-6 mb-5">
          <h3 className="text-sm font-semibold text-black">Today's Attendance Code</h3>
          <p className="text-xs text-gray-400 mt-1 mb-4">Set the code for {today}, then write it on the board. Students check in with it below.</p>
          <form onSubmit={saveTodayCode} className="flex gap-2.5">
            <input type="text" value={todayCode} onChange={e => setTodayCode(e.target.value.toUpperCase())}
              placeholder="e.g. GATORS0915"
              className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-sm text-black font-mono tracking-widest placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-600 focus:border-transparent transition uppercase" />
            <button type="submit" disabled={savingCode || !todayCode.trim()}
              className="px-5 py-2.5 rounded-xl bg-green-700 text-white text-sm font-semibold hover:bg-green-800 transition disabled:opacity-50">
              {savingCode ? 'Saving…' : 'Set Code'}
            </button>
          </form>
          {recentCodes.length > 0 && (
            <div className="mt-5 pt-4 border-t border-gray-100">
              <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-2">Recent codes</p>
              <div className="space-y-1.5">
                {recentCodes.map(c => (
                  <div key={c.date} className="flex items-center gap-3 text-sm">
                    <span className="text-gray-600 w-28">{fmtDate(c.date)}</span>
                    <span className="font-mono text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded-lg flex-1">{c.code}</span>
                    <button onClick={() => deleteCode(c.date)}
                      className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 transition">
                      Delete
                    </button>
                  </div>
                ))}
              </div>
              <p className="text-[11px] text-gray-500 mt-2">Deleting a code removes that date from the roster's meeting count.</p>
            </div>
          )}
        </div>
      )}

      <div className="bg-white rounded-2xl border border-gray-200 p-6 mb-5">
        <div className="mb-5">
          <h3 className="text-sm font-semibold text-black">Submit Attendance</h3>
          <p className="text-xs text-gray-400 mt-1">Today's code is written on the board at the meeting.</p>
        </div>

        {error && (
          <div className="mb-5 flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl p-3.5 animate-fade-in">
            {Ico.x('w-4 h-4 text-red-500 mt-0.5 flex-shrink-0')}
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">Student Name</label>
              <input type="text" value={user.name} disabled
                className="w-full px-4 py-2.5 rounded-xl border border-gray-100 bg-gray-50 text-sm text-gray-500 cursor-not-allowed" />
              <p className="text-[10px] text-gray-400 mt-1">Auto-filled from your profile</p>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">Meeting Date</label>
              <input type="date" value={todayISO} disabled
                className="w-full px-4 py-2.5 rounded-xl border border-gray-100 bg-gray-50 text-sm text-gray-500 cursor-not-allowed" />
              <p className="text-[10px] text-gray-400 mt-1">Locked to today · {today}</p>
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">Attendance Code</label>
            <input type="text" value={code} onChange={e => setCode(e.target.value.toUpperCase())}
              placeholder="Enter the code from today's meeting"
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm text-black font-mono tracking-widest placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-600 focus:border-transparent transition uppercase" required />
          </div>
          <button type="submit" disabled={loading}
            className="w-full bg-green-700 text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-green-800 transition disabled:opacity-50 flex items-center justify-center gap-2">
            {loading ? <><Spinner /> Verifying code…</> : 'Log Attendance'}
          </button>
        </form>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h3 className="text-sm font-semibold text-black">My Attendance History</h3>
          <p className="text-[11px] text-gray-400 mt-0.5">{myLogs.length} record{myLogs.length !== 1 ? 's' : ''} — your logs only</p>
        </div>
        {fetchFailed ? (
          <div className="px-6 py-10 text-center">
            <p className="text-sm text-gray-600 mb-3">Couldn't load your attendance history.</p>
            <button onClick={fetchLogs} className="px-4 py-2 rounded-lg border border-gray-300 text-sm font-semibold text-gray-700 hover:border-gray-500 transition">Retry</button>
          </div>
        ) : myLogs.length === 0 ? (
          <div className="px-6 py-12 text-center text-sm text-gray-400">No attendance records yet.</div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                {['Date', 'Checked In At'].map(h => (
                  <th key={h} className="px-6 py-2.5 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {myLogs.map(log => (
                <tr key={log.id} className="hover:bg-gray-50 transition">
                  <td className="px-6 py-3 text-sm font-medium text-black">{fmtDate(log.date)}</td>
                  <td className="px-6 py-3 text-sm text-gray-400">{fmtTime(log.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

/* ================================================================
   TAB 2 — MENTOR SIGN-UP
   ================================================================ */

function MentorTab({ activeRole, user }) {
  const [shifts, setShifts]         = useState([])
  const [confirmId, setConfirmId]   = useState(null)
  const [expandedId, setExpandedId] = useState(null)
  const [toast, setToast]           = useState(null)
  const [showAdd, setShowAdd]       = useState(false)
  const [deleteId, setDeleteId]     = useState(null)
  const [fetchFailed, setFetchFailed] = useState(false)
  const [newShift, setNewShift]     = useState({ title: 'Mentoring shift', date: '', start_time: '3:30 PM', end_time: '5:00 PM', location: '', capacity: 8 })

  const fetchShifts = useCallback(async () => {
    const { data, error: fetchError } = await supabase
      .from('shifts')
      .select('*, shift_signups(id, user_id, profiles(name))')
      .order('date', { ascending: true })
    setFetchFailed(!!fetchError)
    setShifts(data ?? [])
  }, [])

  useEffect(() => { fetchShifts() }, [fetchShifts])

  const todayISO = localISODate()
  const visibleShifts = activeRole === 'admin' ? shifts : shifts.filter(s => s.date >= todayISO)
  const confirmShift = shifts.find(s => s.id === confirmId)

  const handleConfirm = async () => {
    const { error } = await supabase.from('shift_signups').insert({ shift_id: confirmId, user_id: user.id })
    setConfirmId(null)
    if (error) {
      const msg = error.message.includes('full') ? 'This shift is full.'
        : error.code === '23505' ? "You're already signed up for this shift."
        : 'Could not sign you up. Try again.'
      setToast({ message: msg, type: 'error' })
    } else {
      setToast({ message: "You're signed up! See you there.", type: 'success' })
    }
    fetchShifts()
  }

  const removeSignup = async (signupId, wasSelf) => {
    const { error: delError } = await supabase.from('shift_signups').delete().eq('id', signupId)
    setToast(delError
      ? { message: 'Could not remove the sign-up. Try again.', type: 'error' }
      : { message: wasSelf ? 'Your sign-up was cancelled.' : 'Member removed from shift.', type: 'info' })
    fetchShifts()
  }

  const createShift = async (e) => {
    e.preventDefault()
    if (!newShift.date || !newShift.title.trim()) return
    const { error } = await supabase.from('shifts').insert({ ...newShift, capacity: Number(newShift.capacity) || 1 })
    if (error) {
      setToast({ message: 'Could not create the shift.', type: 'error' })
    } else {
      setToast({ message: 'Shift added.', type: 'success' })
      setShowAdd(false)
      setNewShift(prev => ({ ...prev, date: '' }))
      fetchShifts()
    }
  }

  const deleteShift = async () => {
    const { error: delError } = await supabase.from('shifts').delete().eq('id', deleteId)
    setDeleteId(null)
    setToast(delError
      ? { message: 'Could not delete the shift. Try again.', type: 'error' }
      : { message: 'Shift deleted.', type: 'info' })
    fetchShifts()
  }

  return (
    <div className="max-w-3xl animate-fade-in">
      {toast && <Toast {...toast} onClose={() => setToast(null)} />}

      <div className="mb-7 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold text-black">Mentor Sign-Up</h2>
          <p className="text-sm text-gray-500 mt-1">Volunteer for mentoring and outreach shifts</p>
        </div>
        {activeRole === 'admin' && (
          <button onClick={() => setShowAdd(true)}
            className="px-4 py-2.5 bg-green-700 text-white rounded-xl text-sm font-semibold hover:bg-green-800 transition">
            + Add Shift
          </button>
        )}
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h3 className="text-sm font-semibold text-black">Available Shifts</h3>
        </div>
        {fetchFailed ? (
          <div className="py-10 text-center">
            <p className="text-sm text-gray-600 mb-3">Couldn't load shifts.</p>
            <button onClick={fetchShifts} className="px-4 py-2 rounded-lg border border-gray-300 text-sm font-semibold text-gray-700 hover:border-gray-500 transition">Retry</button>
          </div>
        ) : visibleShifts.length === 0 ? (
          <div className="py-12 text-center text-sm text-gray-400">
            No upcoming shifts{activeRole === 'admin' ? ' — add one above.' : '. Check back after the next meeting.'}
          </div>
        ) : (
        <div className="divide-y divide-gray-100">
          {visibleShifts.map(shift => {
            const signups   = shift.shift_signups ?? []
            const taken     = signups.length
            const remaining = Math.max(shift.capacity - taken, 0)
            const signedUp  = signups.some(su => su.user_id === user.id)
            const pct       = (taken / shift.capacity) * 100
            const rosterOpen = expandedId === shift.id
            const isPast    = shift.date < todayISO

            return (
              <div key={shift.id}>
                <div className="flex items-center gap-4 px-6 py-4 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-black">{shift.title} · {fmtDate(shift.date)}</p>
                    <p className="text-xs text-gray-500">{shift.start_time} – {shift.end_time}{shift.location ? ` · ${shift.location}` : ''}</p>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${pct}%`, backgroundColor: remaining === 0 ? '#ef4444' : '#15803d' }} />
                    </div>
                    <span className={`text-xs font-medium ${remaining === 0 ? 'text-red-500' : 'text-gray-600'}`}>
                      {remaining}/{shift.capacity}
                    </span>
                  </div>

                  {isPast ? (
                    <span className="inline-flex items-center px-2.5 py-1 bg-gray-100 text-gray-500 border border-gray-200 rounded-full text-xs font-medium">Past</span>
                  ) : signedUp ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-green-50 text-green-700 border border-green-200 rounded-full text-xs font-medium">
                      {Ico.check('w-3 h-3')} Signed Up
                    </span>
                  ) : remaining === 0 ? (
                    <span className="inline-flex items-center px-2.5 py-1 bg-red-50 text-red-600 border border-red-200 rounded-full text-xs font-medium">Full</span>
                  ) : (
                    <span className="inline-flex items-center px-2.5 py-1 bg-blue-50 text-blue-600 border border-blue-200 rounded-full text-xs font-medium">Open</span>
                  )}

                  {isPast ? null : signedUp ? (
                    <button onClick={() => removeSignup(signups.find(su => su.user_id === user.id)?.id, true)}
                      className="px-3.5 py-1.5 rounded-xl text-xs font-semibold border border-gray-200 text-gray-600 hover:border-gray-400 hover:text-black transition">
                      Cancel
                    </button>
                  ) : remaining === 0 ? (
                    <button disabled className="px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-gray-100 text-gray-400 cursor-not-allowed">
                      Full
                    </button>
                  ) : (
                    <button onClick={() => setConfirmId(shift.id)}
                      className="px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-green-700 text-white hover:bg-green-800 transition">
                      Sign Up
                    </button>
                  )}

                  {activeRole === 'admin' && (
                    <>
                      <button
                        onClick={() => setExpandedId(rosterOpen ? null : shift.id)}
                        className="flex items-center gap-1 text-xs font-semibold text-gray-500 hover:text-black transition px-2 py-1 border border-gray-200 rounded-xl hover:border-gray-400">
                        Roster ({taken})
                        {Ico.chevronDown(`w-3.5 h-3.5 transition-transform ${rosterOpen ? 'rotate-180' : ''}`)}
                      </button>
                      <button onClick={() => setDeleteId(shift.id)}
                        className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 transition">
                        Delete
                      </button>
                    </>
                  )}
                </div>

                {activeRole === 'admin' && rosterOpen && (
                  <div className="px-6 pb-4 bg-gray-50 border-t border-gray-100 animate-fade-in">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest pt-3 mb-2">
                      Signed-Up Volunteers ({taken})
                    </p>
                    {taken === 0 ? (
                      <p className="text-xs text-gray-400 italic">No one signed up yet.</p>
                    ) : (
                      <div className="space-y-1.5">
                        {signups.map(su => (
                          <div key={su.id} className="flex items-center gap-3">
                            <div className="w-6 h-6 rounded-full bg-blue-900 text-white flex items-center justify-center text-[10px] font-bold flex-shrink-0">
                              {(su.profiles?.name ?? '?').charAt(0)}
                            </div>
                            <span className="text-sm font-medium text-black flex-1">{su.profiles?.name ?? 'Member'}</span>
                            <button
                              onClick={() => removeSignup(su.id, su.user_id === user.id)}
                              className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 transition flex-shrink-0">
                              Remove
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
        )}
      </div>

      {confirmShift && (
        <Modal title="Confirm Sign-Up" onClose={() => setConfirmId(null)}>
          <p className="text-sm text-gray-600 mb-3">You're registering for:</p>
          <div className="bg-gray-50 rounded-xl p-4 mb-4 border border-gray-100">
            <p className="text-sm font-semibold text-black">{confirmShift.title} · {fmtDate(confirmShift.date)}</p>
            <p className="text-sm text-gray-500">{confirmShift.start_time} – {confirmShift.end_time}</p>
            {confirmShift.location && <p className="text-xs text-gray-400 mt-1">{confirmShift.location}</p>}
          </div>
          <p className="text-xs text-gray-400 mb-5">By confirming, you commit to attending this shift. Please cancel at least 48 hours in advance if you cannot make it.</p>
          <div className="flex gap-2.5">
            <button onClick={() => setConfirmId(null)} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition">Cancel</button>
            <button onClick={handleConfirm} className="flex-1 py-2.5 rounded-xl bg-green-700 text-white text-sm font-semibold hover:bg-green-800 transition">Confirm</button>
          </div>
        </Modal>
      )}

      {deleteId !== null && (
        <Modal title="Delete Shift" onClose={() => setDeleteId(null)}>
          <p className="text-sm text-gray-600 mb-2">
            Delete <span className="font-semibold text-black">{shifts.find(s => s.id === deleteId)?.title}</span> on{' '}
            <span className="font-semibold text-black">{shifts.find(s => s.id === deleteId) ? fmtDate(shifts.find(s => s.id === deleteId).date) : ''}</span>?
          </p>
          <p className="text-xs text-gray-500 mb-5">
            All {shifts.find(s => s.id === deleteId)?.shift_signups?.length ?? 0} sign-up(s) for this shift will be removed too. This cannot be undone.
          </p>
          <div className="flex gap-2.5">
            <button onClick={() => setDeleteId(null)} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition">Cancel</button>
            <button onClick={deleteShift} className="flex-1 py-2.5 rounded-xl bg-red-600 text-white text-sm font-semibold hover:bg-red-700 transition">Delete Shift</button>
          </div>
        </Modal>
      )}

      {showAdd && (
        <Modal title="Add Shift" onClose={() => setShowAdd(false)}>
          <form onSubmit={createShift} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">Title</label>
              <input type="text" value={newShift.title} onChange={e => setNewShift(p => ({ ...p, title: e.target.value }))}
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm text-black focus:outline-none focus:ring-2 focus:ring-green-600 focus:border-transparent transition" required />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">Date</label>
                <input type="date" value={newShift.date} onChange={e => setNewShift(p => ({ ...p, date: e.target.value }))}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm text-black focus:outline-none focus:ring-2 focus:ring-green-600 focus:border-transparent transition" required />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">Capacity</label>
                <input type="number" min="1" value={newShift.capacity} onChange={e => setNewShift(p => ({ ...p, capacity: e.target.value }))}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm text-black focus:outline-none focus:ring-2 focus:ring-green-600 focus:border-transparent transition" required />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">Starts</label>
                <input type="text" value={newShift.start_time} onChange={e => setNewShift(p => ({ ...p, start_time: e.target.value }))}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm text-black focus:outline-none focus:ring-2 focus:ring-green-600 focus:border-transparent transition" required />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">Ends</label>
                <input type="text" value={newShift.end_time} onChange={e => setNewShift(p => ({ ...p, end_time: e.target.value }))}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm text-black focus:outline-none focus:ring-2 focus:ring-green-600 focus:border-transparent transition" required />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">Location (optional)</label>
              <input type="text" value={newShift.location} onChange={e => setNewShift(p => ({ ...p, location: e.target.value }))}
                placeholder="e.g. Mills Park MS, Science Lab Rm 214"
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm text-black placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-600 focus:border-transparent transition" />
            </div>
            <button type="submit"
              className="w-full bg-green-700 text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-green-800 transition">
              Add Shift
            </button>
          </form>
        </Modal>
      )}
    </div>
  )
}

/* ================================================================
   TAB 3 — ISEF FORMS
   ================================================================ */

function FormsTab() {
  const [wizardStarted, setWizardStarted] = useState(false)
  const [currentQ, setCurrentQ]           = useState(0)
  const [answers, setAnswers]             = useState({})
  const [wizardDone, setWizardDone]       = useState(false)
  const [expanded, setExpanded]           = useState(null)
  const [toast, setToast]                 = useState(null)

  const requiredList = wizardDone
    ? [...new Set(['Form 1', 'Form 1A', 'NCSEF',
        ...WIZARD_QUESTIONS.filter(q => answers[q.id] === 'yes').flatMap(q => q.required)])]
    : []

  const answerQ = (qId, val) => {
    setAnswers(prev => ({ ...prev, [qId]: val }))
    if (currentQ + 1 < WIZARD_QUESTIONS.length) setCurrentQ(currentQ + 1)
    else setWizardDone(true)
  }

  const reset = () => { setWizardStarted(false); setCurrentQ(0); setAnswers({}); setWizardDone(false) }

  const handleDownload = (form, src) => {
    const href = src || form.pdfSrc
    const filename = href ? href.split('/').pop() : `ISEF_${form.tag.replace(/[\s/]+/g, '_')}.pdf`
    const a = Object.assign(document.createElement('a'), { href, download: filename })
    document.body.appendChild(a); a.click(); document.body.removeChild(a)
    setToast({ message: `${form.tag} downloaded.`, type: 'success' })
  }

  return (
    <div className="max-w-3xl animate-fade-in">
      {toast && <Toast {...toast} onClose={() => setToast(null)} />}

      <div className="mb-7">
        <h2 className="text-2xl font-bold text-black">ISEF Forms</h2>
        <p className="text-sm text-gray-500 mt-1">Find your required forms and learn exactly how to complete them</p>
      </div>

      {/* Wizard */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6 mb-5">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-sm font-semibold text-black">Form Requirement Wizard</h3>
            <p className="text-[11px] text-gray-400 mt-0.5">8 questions · ~2 minutes</p>
          </div>
          {wizardStarted && <button onClick={reset} className="text-xs text-gray-400 hover:text-black transition">Start over</button>}
        </div>

        {!wizardStarted && !wizardDone && (
          <div className="text-center py-6 animate-fade-in">
            <div className="w-11 h-11 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
              <svg className="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <p className="text-sm font-semibold text-black mb-1">Not sure which forms you need?</p>
            <p className="text-sm text-gray-500 mb-5">Answer a few project-specific questions to get your personalized list.</p>
            <button onClick={() => { setWizardStarted(true); setCurrentQ(0) }}
              className="px-5 py-2 bg-green-700 text-white rounded-xl text-sm font-semibold hover:bg-green-800 transition">
              Start Wizard
            </button>
          </div>
        )}

        {wizardStarted && !wizardDone && (
          <div className="animate-fade-in">
            <div className="flex gap-1 mb-5">
              {WIZARD_QUESTIONS.map((_, i) => (
                <div key={i} className={`flex-1 h-1 rounded-full transition-all duration-300 ${i <= currentQ ? 'bg-green-700' : 'bg-gray-200'}`} />
              ))}
            </div>
            <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2">
              Question {currentQ + 1} of {WIZARD_QUESTIONS.length}
            </p>
            <p className="text-sm font-medium text-black mb-1.5">{WIZARD_QUESTIONS[currentQ].text}</p>
            {WIZARD_QUESTIONS[currentQ].note && (
              <p className="text-xs text-gray-400 italic mb-4">{WIZARD_QUESTIONS[currentQ].note}</p>
            )}
            <div className="flex gap-2.5">
              <button onClick={() => answerQ(WIZARD_QUESTIONS[currentQ].id, 'yes')}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-black hover:border-green-700 hover:bg-gray-50 transition">Yes</button>
              <button onClick={() => answerQ(WIZARD_QUESTIONS[currentQ].id, 'no')}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-black hover:border-green-700 hover:bg-gray-50 transition">No</button>
            </div>
          </div>
        )}

        {wizardDone && (
          <div className="animate-fade-in">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-5 h-5 rounded-full bg-green-100 flex items-center justify-center">
                {Ico.check('w-3 h-3 text-green-600')}
              </div>
              <p className="text-sm font-semibold text-black">Your Required Forms</p>
            </div>
            <div className="mb-3">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Required for all projects</p>
              <div className="flex flex-wrap gap-2">
                {['Form 1', 'Form 1A', 'NCSEF'].map(f => (
                  <span key={f} className="inline-flex items-center px-3 py-1.5 bg-green-700 text-white rounded-xl text-xs font-semibold">{f}</span>
                ))}
              </div>
            </div>
            {requiredList.filter(f => !['Form 1', 'Form 1A', 'NCSEF'].includes(f)).length > 0 && (
              <div className="mb-3">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Required based on your project</p>
                <div className="flex flex-wrap gap-2">
                  {requiredList.filter(f => !['Form 1', 'Form 1A', 'NCSEF'].includes(f)).map(f => (
                    <span key={f} className="inline-flex items-center px-3 py-1.5 bg-gray-800 text-white rounded-xl text-xs font-semibold">{f}</span>
                  ))}
                </div>
              </div>
            )}
            <p className="text-xs text-gray-400 mt-1">Forms marked <span className="font-semibold text-amber-600">Required</span> are highlighted below.</p>
          </div>
        )}
      </div>

      {/* Form Library */}
      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h3 className="text-sm font-semibold text-black">Form Library</h3>
          <p className="text-[11px] text-gray-400 mt-0.5">Click any form to see instructions — Download saves a reference copy</p>
        </div>
        <div>
          {ISEF_FORMS.map((form, i) => {
            const isExpanded = expanded === form.id
            const isRequired = requiredList.includes(form.tag)
            return (
              <div key={form.id} className={i > 0 ? 'border-t border-gray-100' : ''}>
                <button className="w-full flex items-center gap-4 px-6 py-4 hover:bg-gray-50 transition text-left"
                  onClick={() => setExpanded(isExpanded ? null : form.id)}>
                  <span className="text-[11px] font-bold bg-green-700 text-white px-2 py-1 rounded-lg whitespace-nowrap flex-shrink-0">{form.tag}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-black">{form.title}</span>
                      {isRequired && <span className="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-md uppercase tracking-wider">Required</span>}
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5 truncate">{form.what}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                    <span onClick={e => { e.stopPropagation(); handleDownload(form) }}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-black px-2.5 py-1.5 border border-gray-200 rounded-xl hover:bg-gray-100 transition cursor-pointer">
                      {Ico.download('w-3.5 h-3.5')} Download
                    </span>
                    {form.sampleConsentPdf && (
                      <span onClick={e => { e.stopPropagation(); handleDownload(form, form.sampleConsentPdf) }}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-gray-600 px-2.5 py-1.5 border border-gray-200 rounded-xl hover:bg-gray-100 transition cursor-pointer">
                        {Ico.download('w-3.5 h-3.5')} Sample Consent
                      </span>
                    )}
                    {Ico.chevronDown(`w-4 h-4 text-gray-400 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`)}
                  </div>
                </button>
                {isExpanded && (
                  <div className="px-6 pb-6 border-t border-gray-50 bg-gray-50 animate-fade-in">
                    <div className="pt-5 grid md:grid-cols-2 gap-6">
                      <div>
                        <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2">What It Is</p>
                        <p className="text-sm text-gray-700 leading-relaxed">{form.what}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2">How to Complete</p>
                        <ul className="space-y-2">
                          {form.how.map((step, idx) => (
                            <li key={idx} className="flex items-start gap-2">
                              <span className="w-5 h-5 bg-green-700 text-white rounded-full text-[10px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">{idx + 1}</span>
                              <span className="text-sm text-gray-700 leading-snug">{step}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

/* ================================================================
   TAB 4 — RESEARCH HUB
   ================================================================ */

function ResearchTab({ activeRole, user }) {
  const [dragging, setDragging]     = useState(false)
  const [docType, setDocType]       = useState('Form 1A — Student Checklist')
  const [denyDocId, setDenyDocId]   = useState(null)
  const [denyReason, setDenyReason] = useState('')
  const [viewerDoc, setViewerDoc]   = useState(null)
  const [toast, setToast]           = useState(null)
  const [documents, setDocuments]   = useState([])
  const [uploading, setUploading]   = useState(false)
  const [deleteDoc, setDeleteDoc]   = useState(null)   // { id, storagePath, file }
  const [fetchFailed, setFetchFailed] = useState(false)
  const fileRef                     = useRef(null)

  const fetchDocs = useCallback(async () => {
    // RLS scopes this automatically: students get their own rows, admins get all.
    const { data, error: fetchError } = await supabase
      .from('documents')
      .select('*, profiles(name)')
      .order('created_at', { ascending: false })
    setFetchFailed(!!fetchError)
    setDocuments((data ?? []).map(d => ({
      id: d.id,
      file: d.filename,
      type: d.doc_type,
      date: fmtDate(d.created_at),
      size: d.size_bytes
        ? (d.size_bytes > 1024 * 1024 ? `${(d.size_bytes / (1024 * 1024)).toFixed(1)} MB` : `${Math.round(d.size_bytes / 1024)} KB`)
        : '',
      status: DOC_STATUS_LABELS[d.status] ?? d.status,
      feedback: d.feedback,
      student: d.profiles?.name ?? '',
      studentId: d.user_id,
      storagePath: d.storage_path,
    })))
  }, [])

  useEffect(() => { fetchDocs() }, [fetchDocs])

  const myDocs = documents.filter(d => d.studentId === user.id)

  const addDoc = async (file) => {
    if (file.size > 5 * 1024 * 1024) {
      setToast({ message: 'That file is over the 5 MB limit. Compress it and try again.', type: 'error' })
      return
    }
    setUploading(true)
    const path = `${user.id}/${Date.now()}_${file.name.replace(/[^\w.\-]+/g, '_')}`
    const { error: uploadError } = await supabase.storage.from('documents').upload(path, file)
    if (uploadError) {
      setToast({ message: `Upload failed: ${uploadError.message}`, type: 'error' })
    } else {
      const { error: insertError } = await supabase.from('documents').insert({
        user_id: user.id, doc_type: docType, filename: file.name,
        storage_path: path, size_bytes: file.size,
      })
      if (insertError) {
        // Don't leave an unrecorded file in the bucket.
        await supabase.storage.from('documents').remove([path])
        setToast({ message: 'Upload failed. Try again.', type: 'error' })
      } else {
        setToast({ message: `${file.name} uploaded — pending review.`, type: 'success' })
        fetchDocs()
      }
    }
    setUploading(false)
  }

  const openViewer = async (doc) => {
    const [{ data: view, error: viewError }, { data: dl }] = await Promise.all([
      supabase.storage.from('documents').createSignedUrl(doc.storagePath, 3600),
      supabase.storage.from('documents').createSignedUrl(doc.storagePath, 3600, { download: doc.file }),
    ])
    if (viewError || !view?.signedUrl) {
      setToast({ message: "Couldn't load the preview. Try again in a moment.", type: 'error' })
      return
    }
    setViewerDoc({ ...doc, pdfSrc: view.signedUrl, downloadUrl: dl?.signedUrl ?? view.signedUrl })
  }

  const handleFiles = (e) => { if (e.target.files[0]) addDoc(e.target.files[0]); e.target.value = '' }
  const handleDrop  = (e) => { e.preventDefault(); setDragging(false); if (e.dataTransfer.files[0]) addDoc(e.dataTransfer.files[0]) }
  const approve     = async (id) => {
    const { error: updError } = await supabase.from('documents').update({ status: 'approved', feedback: null }).eq('id', id)
    setToast(updError
      ? { message: 'Could not approve the document. Try again.', type: 'error' }
      : { message: 'Document approved.', type: 'success' })
    fetchDocs()
  }
  const submitDeny  = async () => {
    if (!denyReason.trim()) return
    const { error: updError } = await supabase.from('documents').update({ status: 'denied', feedback: denyReason.trim() }).eq('id', denyDocId)
    setToast(updError
      ? { message: 'Could not send the feedback. Try again.', type: 'error' }
      : { message: 'Feedback sent to student.', type: 'info' })
    setDenyDocId(null); setDenyReason(''); fetchDocs()
  }
  const confirmDeleteDoc = async () => {
    const { error: storageError } = await supabase.storage.from('documents').remove([deleteDoc.storagePath])
    // A missing storage object shouldn't block removing the record.
    const { error: rowError } = await supabase.from('documents').delete().eq('id', deleteDoc.id)
    setDeleteDoc(null)
    setToast(rowError
      ? { message: 'Could not delete the document. Try again.', type: 'error' }
      : { message: `${deleteDoc.file} deleted.`, type: 'info' })
    if (storageError && !rowError) console.warn('Storage object not removed:', storageError.message)
    fetchDocs()
  }

  const stats = [
    { label: 'Pending',   count: documents.filter(d => d.status === 'Pending Review').length,    color: 'text-amber-600', bg: 'bg-amber-50 border-amber-100' },
    { label: 'Approved',  count: documents.filter(d => d.status === 'Approved').length,           color: 'text-green-600', bg: 'bg-green-50 border-green-100' },
    { label: 'Revisions', count: documents.filter(d => d.status === 'Changes Requested').length,  color: 'text-red-600',   bg: 'bg-red-50 border-red-100' },
  ]

  const FileRow = ({ doc, showStudent = false }) => (
    <div className="px-6 py-4 animate-fade-in">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-start gap-3 min-w-0">
          <div className="w-9 h-9 bg-gray-100 rounded-xl flex items-center justify-center flex-shrink-0">
            {Ico.file('w-4 h-4 text-gray-500')}
          </div>
          <div className="min-w-0">
            <button onClick={() => openViewer(doc)}
              className="text-sm font-medium text-black hover:underline underline-offset-2 text-left truncate block max-w-xs">
              {doc.file}
            </button>
            <p className="text-[11px] text-gray-400 mt-0.5">
              {showStudent && <><span className="font-semibold text-gray-600">{doc.student}</span> · </>}
              {doc.type} · {doc.date}{doc.size ? ` · ${doc.size}` : ''}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">
          <Badge status={doc.status} />
          {activeRole === 'admin' && doc.status === 'Pending Review' && (
            <>
              <button onClick={() => approve(doc.id)} className="px-3 py-1.5 bg-green-600 text-white rounded-xl text-xs font-semibold hover:bg-green-700 transition">Approve</button>
              <button onClick={() => { setDenyDocId(doc.id); setDenyReason('') }} className="px-3 py-1.5 bg-red-500 text-white rounded-xl text-xs font-semibold hover:bg-red-600 transition">Deny</button>
            </>
          )}
          {(activeRole === 'admin' || (doc.studentId === user.id && doc.status === 'Pending Review')) && (
            <button onClick={() => setDeleteDoc(doc)}
              className="px-2.5 py-1.5 rounded-xl text-xs font-semibold bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 transition">
              Delete
            </button>
          )}
        </div>
      </div>
      {doc.feedback && (
        <div className="mt-3 ml-12 bg-red-50 border border-red-100 rounded-xl p-3.5">
          <p className="text-[11px] font-bold text-red-700 uppercase tracking-wider mb-1">{activeRole === 'admin' ? 'Denial Reason Sent' : 'Reviewer Feedback'}</p>
          <p className="text-xs text-red-700 leading-relaxed">{doc.feedback}</p>
        </div>
      )}
    </div>
  )

  return (
    <div className="max-w-4xl animate-fade-in">
      {toast && <Toast {...toast} onClose={() => setToast(null)} />}
      {viewerDoc && <DocViewerModal doc={viewerDoc} onClose={() => setViewerDoc(null)} />}

      <div className="mb-7">
        <div className="flex items-center gap-3 flex-wrap">
          <h2 className="text-2xl font-bold text-black">Research Hub</h2>
          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${activeRole === 'admin' ? 'bg-violet-50 text-violet-700 border-violet-200' : 'bg-blue-50 text-blue-700 border-blue-200'}`}>
            {activeRole === 'admin' ? '⚙ Admin View' : '👤 Student View'}
          </span>
        </div>
        <p className="text-sm text-gray-500 mt-1">
          {activeRole === 'admin' ? 'Review student submissions — click any filename to preview' : 'Upload documents and track review status — click a filename to preview'}
        </p>
      </div>

      {activeRole === 'student' && (
        <>
          <div className="bg-white rounded-2xl border border-gray-200 p-6 mb-5">
            <h3 className="text-sm font-semibold text-black mb-4">Upload Document</h3>
            <div className="flex flex-wrap gap-2 mb-4">
              {['Form 1 — Adult Sponsor', 'Form 1A — Student Checklist', 'Form 4 — Human Participants', 'Form 4 — Informed Consent', 'NCSEF Parent Release', 'Research Plan', 'Research Paper', 'Other ISEF Form'].map(t => (
                <button key={t} onClick={() => setDocType(t)}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold border transition ${docType === t ? 'bg-green-700 text-white border-green-700' : 'text-gray-600 border-gray-200 hover:border-gray-400'}`}>
                  {t}
                </button>
              ))}
            </div>
            <div onDragOver={e => { e.preventDefault(); setDragging(true) }} onDragLeave={() => setDragging(false)}
              onDrop={uploading ? undefined : handleDrop} onClick={() => { if (!uploading) fileRef.current?.click() }}
              className={`border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all ${dragging ? 'border-green-700 bg-gray-50 scale-[1.01]' : 'border-gray-200 hover:border-gray-400 hover:bg-gray-50'}`}>
              <input ref={fileRef} type="file" className="hidden" onChange={handleFiles} accept=".pdf,.doc,.docx,.png,.jpg,.jpeg" />
              {Ico.upload('w-10 h-10 text-gray-300 mx-auto mb-3')}
              <p className="text-sm font-semibold text-black mb-1">{uploading ? 'Uploading…' : dragging ? 'Drop it!' : 'Drag & drop your file here'}</p>
              <p className="text-xs text-gray-400">or click to browse — PDF, DOCX, PNG up to 5 MB</p>
              <p className="text-xs text-gray-400 mt-1">Uploading as: <span className="font-semibold text-black">{docType}</span></p>
            </div>
          </div>
          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100">
              <h3 className="text-sm font-semibold text-black">My Submissions</h3>
              <p className="text-[11px] text-gray-400 mt-0.5">{myDocs.length} document{myDocs.length !== 1 ? 's' : ''} · click a filename to preview</p>
            </div>
            {fetchFailed ? (
              <div className="py-10 text-center">
                <p className="text-sm text-gray-600 mb-3">Couldn't load your documents.</p>
                <button onClick={fetchDocs} className="px-4 py-2 rounded-lg border border-gray-300 text-sm font-semibold text-gray-700 hover:border-gray-500 transition">Retry</button>
              </div>
            ) : myDocs.length === 0 ? <div className="py-12 text-center text-sm text-gray-400">No documents uploaded yet.</div>
              : <div className="divide-y divide-gray-50">{myDocs.map(d => <FileRow key={d.id} doc={d} />)}</div>}
          </div>
        </>
      )}

      {activeRole === 'admin' && (
        <>
          <div className="grid grid-cols-3 gap-3 mb-5">
            {stats.map(s => (
              <div key={s.label} className={`rounded-2xl border p-5 ${s.bg}`}>
                <p className={`text-3xl font-bold ${s.color}`}>{s.count}</p>
                <p className="text-xs font-medium text-gray-500 mt-1">{s.label}</p>
              </div>
            ))}
          </div>
          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100">
              <h3 className="text-sm font-semibold text-black">Review Queue</h3>
              <p className="text-[11px] text-gray-400 mt-0.5">Click any filename to open the document viewer</p>
            </div>
            {fetchFailed ? (
              <div className="py-10 text-center">
                <p className="text-sm text-gray-600 mb-3">Couldn't load the review queue.</p>
                <button onClick={fetchDocs} className="px-4 py-2 rounded-lg border border-gray-300 text-sm font-semibold text-gray-700 hover:border-gray-500 transition">Retry</button>
              </div>
            ) : documents.length === 0 ? (
              <div className="py-12 text-center text-sm text-gray-400">No submissions yet.</div>
            ) : (
              <div className="divide-y divide-gray-50">
                {documents.map(d => <FileRow key={d.id} doc={d} showStudent />)}
              </div>
            )}
          </div>
        </>
      )}

      {denyDocId !== null && (
        <Modal title="Request Changes" onClose={() => setDenyDocId(null)}>
          <p className="text-sm text-gray-600 mb-4">Provide specific, actionable feedback so the student knows exactly what to revise.</p>
          <textarea value={denyReason} onChange={e => setDenyReason(e.target.value)} rows={5}
            placeholder="e.g. Please revise the methodology section — your control variables need clearer definitions…"
            className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm text-black placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-600 focus:border-transparent resize-none transition" />
          <div className="flex gap-2.5 mt-4">
            <button onClick={() => setDenyDocId(null)} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition">Cancel</button>
            <button onClick={submitDeny} disabled={!denyReason.trim()} className="flex-1 py-2.5 rounded-xl bg-red-500 text-white text-sm font-semibold hover:bg-red-600 transition disabled:opacity-40 disabled:cursor-not-allowed">Send Feedback</button>
          </div>
        </Modal>
      )}

      {deleteDoc && (
        <Modal title="Delete Document" onClose={() => setDeleteDoc(null)}>
          <p className="text-sm text-gray-600 mb-2">
            Delete <span className="font-semibold text-black">{deleteDoc.file}</span>?
          </p>
          <p className="text-xs text-gray-500 mb-5">The file is removed from storage permanently. This cannot be undone.</p>
          <div className="flex gap-2.5">
            <button onClick={() => setDeleteDoc(null)} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition">Cancel</button>
            <button onClick={confirmDeleteDoc} className="flex-1 py-2.5 rounded-xl bg-red-600 text-white text-sm font-semibold hover:bg-red-700 transition">Delete</button>
          </div>
        </Modal>
      )}
    </div>
  )
}

/* ================================================================
   TAB 5 — SUPPORT TICKETS
   ================================================================ */

function SupportTab({ user, activeRole }) {
  const [subject, setSubject]       = useState('')
  const [message, setMessage]       = useState('')
  const [replyingId, setReplyingId] = useState(null)
  const [replyText, setReplyText]   = useState('')
  const [toast, setToast]           = useState(null)
  const [tickets, setTickets]       = useState([])
  const [deleteTicket, setDeleteTicket] = useState(null)   // { id, subject }
  const [fetchFailed, setFetchFailed] = useState(false)

  const fetchTickets = useCallback(async () => {
    // RLS scopes this automatically: students see their own, admins see all.
    const { data, error: fetchError } = await supabase
      .from('tickets')
      .select('*, profiles(name), ticket_replies(id, body, created_at)')
      .order('created_at', { ascending: false })
    setFetchFailed(!!fetchError)
    setTickets((data ?? []).map(t => {
      const replies = [...(t.ticket_replies ?? [])].sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
      return {
        id: t.id,
        subject: t.subject,
        message: t.body,
        status: TICKET_STATUS_LABELS[t.status] ?? t.status,
        reply: replies.length ? replies[replies.length - 1].body : null,
        studentName: t.profiles?.name ?? '',
        studentId: t.user_id,
        date: fmtDate(t.created_at),
        time: fmtTime(t.created_at),
      }
    }))
  }, [])

  useEffect(() => { fetchTickets() }, [fetchTickets])

  const myTickets  = tickets.filter(t => t.studentId === user.id)
  const allTickets = tickets

  const submitQuestion = async (e) => {
    e.preventDefault()
    if (!subject.trim() || !message.trim()) return
    const { error } = await supabase.from('tickets').insert({
      user_id: user.id, subject: subject.trim(), body: message.trim(),
    })
    if (error) {
      setToast({ message: 'Could not submit your question. Try again.', type: 'error' })
    } else {
      setToast({ message: "Question submitted — we'll respond shortly.", type: 'success' })
      setSubject(''); setMessage('')
      fetchTickets()
    }
  }

  const sendReply = async (id) => {
    if (!replyText.trim()) return
    const { error } = await supabase.from('ticket_replies').insert({
      ticket_id: id, user_id: user.id, body: replyText.trim(),
    })
    if (error) {
      setToast({ message: 'Could not send the reply. Try again.', type: 'error' })
    } else {
      const { error: statusError } = await supabase.from('tickets').update({ status: 'answered' }).eq('id', id)
      if (statusError) console.warn('Reply saved but status not updated:', statusError.message)
      setToast({ message: 'Reply sent to student.', type: 'success' })
      setReplyingId(null); setReplyText('')
      fetchTickets()
    }
  }

  const confirmDeleteTicket = async () => {
    const { error: delError } = await supabase.from('tickets').delete().eq('id', deleteTicket.id)
    setDeleteTicket(null)
    setToast(delError
      ? { message: 'Could not delete the question. Try again.', type: 'error' }
      : { message: 'Question deleted.', type: 'info' })
    fetchTickets()
  }

  return (
    <div className="max-w-3xl animate-fade-in">
      {toast && <Toast {...toast} onClose={() => setToast(null)} />}

      <div className="mb-7">
        <h2 className="text-2xl font-bold text-black">Questions</h2>
        <p className="text-sm text-gray-500 mt-1">
          {activeRole === 'admin' ? 'Student questions inbox — reply to open questions' : 'Ask a question or get help from your advisor'}
        </p>
      </div>

      {/* ── STUDENT VIEW ── */}
      {activeRole === 'student' && (
        <>
          <div className="bg-white rounded-2xl border border-gray-200 p-6 mb-5">
            <h3 className="text-sm font-semibold text-black mb-4">Submit a Question</h3>
            <form onSubmit={submitQuestion} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">Subject</label>
                <input type="text" value={subject} onChange={e => setSubject(e.target.value)} placeholder="e.g. Question about Form 1A deadline"
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm text-black placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-600 focus:border-transparent transition" required />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">Your Question</label>
                <textarea value={message} onChange={e => setMessage(e.target.value)} rows={4}
                  placeholder="Describe your question in detail…"
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm text-black placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-600 focus:border-transparent resize-none transition" required />
              </div>
              <button type="submit"
                className="w-full bg-green-700 text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-green-800 transition">
                Submit Question
              </button>
            </form>
          </div>

          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100">
              <h3 className="text-sm font-semibold text-black">My Questions</h3>
              <p className="text-[11px] text-gray-400 mt-0.5">{myTickets.length} question{myTickets.length !== 1 ? 's' : ''}</p>
            </div>
            {fetchFailed ? (
              <div className="py-10 text-center">
                <p className="text-sm text-gray-600 mb-3">Couldn't load your questions.</p>
                <button onClick={fetchTickets} className="px-4 py-2 rounded-lg border border-gray-300 text-sm font-semibold text-gray-700 hover:border-gray-500 transition">Retry</button>
              </div>
            ) : myTickets.length === 0 ? (
              <div className="py-12 text-center text-sm text-gray-400">No questions submitted yet.</div>
            ) : (
              <div className="divide-y divide-gray-50">
                {[...myTickets].sort((a, b) => b.id - a.id).map(t => (
                  <div key={t.id} className="px-6 py-4">
                    <div className="flex items-start justify-between gap-3 mb-1">
                      <p className="text-sm font-semibold text-black">{t.subject}</p>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <Badge status={t.status} />
                        <button onClick={() => setDeleteTicket(t)}
                          className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 transition">
                          Delete
                        </button>
                      </div>
                    </div>
                    <p className="text-xs text-gray-400 mb-2">{t.date} · {t.time}</p>
                    <p className="text-sm text-gray-700 bg-gray-50 rounded-xl p-3 border border-gray-100">{t.message}</p>
                    {t.reply && (
                      <div className="mt-3 bg-green-50 border border-green-100 rounded-xl p-3.5">
                        <p className="text-[11px] font-bold text-green-700 uppercase tracking-wider mb-1">Advisor Reply</p>
                        <p className="text-xs text-green-800 leading-relaxed">{t.reply}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* ── ADMIN VIEW ── */}
      {activeRole === 'admin' && (
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-black">Inbox</h3>
              <p className="text-[11px] text-gray-400 mt-0.5">{allTickets.length} total · {allTickets.filter(t => t.status === 'Unanswered').length} unanswered</p>
            </div>
          </div>
          {fetchFailed ? (
            <div className="py-10 text-center">
              <p className="text-sm text-gray-600 mb-3">Couldn't load the inbox.</p>
              <button onClick={fetchTickets} className="px-4 py-2 rounded-lg border border-gray-300 text-sm font-semibold text-gray-700 hover:border-gray-500 transition">Retry</button>
            </div>
          ) : allTickets.length === 0 ? (
            <div className="py-12 text-center text-sm text-gray-400">No questions yet.</div>
          ) : (
            <div className="divide-y divide-gray-50">
              {allTickets.map(t => (
                <div key={t.id} className="px-6 py-4">
                  <div className="flex items-start justify-between gap-3 mb-1 flex-wrap">
                    <div>
                      <p className="text-sm font-semibold text-black">{t.subject}</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        <span className="font-semibold text-gray-600">{t.studentName}</span> · {t.date} · {t.time}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Badge status={t.status} />
                      <button onClick={() => setDeleteTicket(t)}
                        className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 transition">
                        Delete
                      </button>
                    </div>
                  </div>
                  <p className="text-sm text-gray-700 bg-gray-50 rounded-xl p-3 border border-gray-100 mt-2">{t.message}</p>

                  {t.reply && (
                    <div className="mt-3 bg-green-50 border border-green-100 rounded-xl p-3.5">
                      <p className="text-[11px] font-bold text-green-700 uppercase tracking-wider mb-1">Your Reply</p>
                      <p className="text-xs text-green-800 leading-relaxed">{t.reply}</p>
                    </div>
                  )}

                  {t.status === 'Unanswered' && (
                    replyingId === t.id ? (
                      <div className="mt-3 animate-fade-in">
                        <textarea value={replyText} onChange={e => setReplyText(e.target.value)} rows={3}
                          placeholder="Type your reply…"
                          className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm text-black placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-600 focus:border-transparent resize-none transition" />
                        <div className="flex gap-2 mt-2">
                          <button onClick={() => { setReplyingId(null); setReplyText('') }}
                            className="px-4 py-2 rounded-xl border border-gray-200 text-xs font-semibold text-gray-600 hover:bg-gray-50 transition">Cancel</button>
                          <button onClick={() => sendReply(t.id)} disabled={!replyText.trim()}
                            className="px-4 py-2 rounded-xl bg-green-700 text-white text-xs font-semibold hover:bg-green-800 transition disabled:opacity-40">Send Reply</button>
                        </div>
                      </div>
                    ) : (
                      <button onClick={() => { setReplyingId(t.id); setReplyText('') }}
                        className="mt-3 px-4 py-2 rounded-xl border border-gray-200 text-xs font-semibold text-black hover:bg-gray-50 hover:border-gray-400 transition">
                        Reply
                      </button>
                    )
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {deleteTicket && (
        <Modal title="Delete Question" onClose={() => setDeleteTicket(null)}>
          <p className="text-sm text-gray-600 mb-2">
            Delete <span className="font-semibold text-black">{deleteTicket.subject}</span>?
          </p>
          <p className="text-xs text-gray-500 mb-5">The question and any replies are removed permanently.</p>
          <div className="flex gap-2.5">
            <button onClick={() => setDeleteTicket(null)} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition">Cancel</button>
            <button onClick={confirmDeleteTicket} className="flex-1 py-2.5 rounded-xl bg-red-600 text-white text-sm font-semibold hover:bg-red-700 transition">Delete</button>
          </div>
        </Modal>
      )}
    </div>
  )
}

/* ================================================================
   TAB 6 — CLUB ROSTER (ADMIN ONLY)
   ================================================================ */

function RosterTab() {
  const [toast, setToast]           = useState(null)
  const [members, setMembers]       = useState([])
  const [meetingDates, setMeetingDates] = useState([])
  const [logs, setLogs]             = useState([])

  useEffect(() => {
    (async () => {
      const [{ data: profiles }, { data: codes }, { data: logRows }] = await Promise.all([
        // Emails are admin-only; this definer RPC returns them for admins.
        supabase.rpc('admin_list_profiles'),
        supabase.from('attendance_codes').select('date').order('date'),
        supabase.from('attendance_logs').select('user_id, date'),
      ])
      setMembers((profiles ?? []).filter(p => p.role === 'student'))
      setMeetingDates((codes ?? []).map(c => c.date))
      setLogs(logRows ?? [])
    })()
  }, [])

  const present = (memberId, date) => logs.some(l => l.user_id === memberId && l.date === date)

  const handleExport = () => {
    const q = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`
    const header = ['Student', 'Email', ...meetingDates.map(fmtDate)].map(q).join(',')
    const rows = members.map(m => {
      const cols = meetingDates.map(d => (present(m.id, d) ? 'Present' : 'Absent'))
      return [m.name, m.email ?? '', ...cols].map(q).join(',')
    })
    downloadText('STEMRC_Attendance_Roster.csv', [header, ...rows].join('\n'))
    setToast({ message: 'STEMRC_Attendance_Roster.csv exported successfully.', type: 'success' })
  }

  return (
    <div className="max-w-5xl animate-fade-in">
      {toast && <Toast {...toast} onClose={() => setToast(null)} />}

      <div className="mb-7 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold text-black">Club Roster</h2>
          <p className="text-sm text-gray-500 mt-1">Attendance matrix across all scheduled meeting dates</p>
        </div>
        <button onClick={handleExport}
          className="flex items-center gap-2 px-4 py-2.5 bg-green-700 text-white rounded-xl text-sm font-semibold hover:bg-green-800 transition">
          {Ico.export('w-4 h-4')} Export Table
        </button>
      </div>

      {/* Summary row */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        {[
          { label: 'Members', value: members.length },
          { label: 'Meetings', value: meetingDates.length },
          { label: 'Total Check-ins', value: logs.length },
        ].map(s => (
          <div key={s.label} className="bg-white border border-gray-200 rounded-2xl p-5">
            <p className="text-3xl font-bold text-black">{s.value}</p>
            <p className="text-xs font-medium text-gray-500 mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Matrix table */}
      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        {members.length === 0 ? (
          <div className="py-12 text-center text-sm text-gray-400">
            No members yet. Accounts are created in the Supabase dashboard (Authentication → Add user).
          </div>
        ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="px-6 py-3 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider sticky left-0 bg-gray-50 min-w-[160px]">Student</th>
                {meetingDates.map(d => (
                  <th key={d} className="px-4 py-3 text-center text-[11px] font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">{fmtDate(d)}</th>
                ))}
                <th className="px-4 py-3 text-center text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {members.map(student => {
                const attended = meetingDates.map(d => present(student.id, d))
                const total = attended.filter(Boolean).length
                return (
                  <tr key={student.id} className="hover:bg-gray-50 transition">
                    <td className="px-6 py-3 sticky left-0 bg-white">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-full bg-blue-900 text-white flex items-center justify-center text-[11px] font-bold flex-shrink-0">
                          {student.name.charAt(0)}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-black">{student.name}</p>
                          <p className="text-[10px] text-gray-400 font-mono">{student.email ?? ''}</p>
                        </div>
                      </div>
                    </td>
                    {attended.map((isPresent, i) => (
                      <td key={i} className="px-4 py-3 text-center">
                        {isPresent ? (
                          <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-green-100">
                            {Ico.check('w-3.5 h-3.5 text-green-600')}
                          </span>
                        ) : (
                          <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-gray-100">
                            {Ico.x('w-3.5 h-3.5 text-gray-400')}
                          </span>
                        )}
                      </td>
                    ))}
                    <td className="px-4 py-3 text-center">
                      <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${meetingDates.length > 0 && total === meetingDates.length ? 'bg-green-100 text-green-700' : total === 0 ? 'bg-red-50 text-red-500' : 'bg-gray-100 text-gray-600'}`}>
                        {total}/{meetingDates.length}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        )}
      </div>
    </div>
  )
}

/* ================================================================
   ROOT APP
   ================================================================ */

export default function App() {
  const [view, setView]           = useState('home')   // 'home' | 'login' | 'portal'
  const [session, setSession]     = useState(null)
  const [user, setUser]           = useState(null)     // profile: { id, email, name, role, initials }
  const [authReady, setAuthReady] = useState(false)
  const [profileError, setProfileError] = useState(false)
  const [activeTab, setActiveTab] = useState('attendance')
  const lastUserId                = useRef(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setAuthReady(true)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => setSession(s))
    return () => sub.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!session) { setUser(null); lastUserId.current = null; return }
    let cancelled = false
    supabase.from('profiles').select('id, name, role').eq('id', session.user.id).single().then(({ data, error }) => {
      if (cancelled) return
      if (error || !data) { setProfileError(true); return }
      setProfileError(false)
      setUser({
        id: data.id,
        email: session.user.email,
        name: data.name,
        role: data.role,
        initials: initialsOf(data.name),
      })
      // Only jump into the portal on an actual sign-in, not on
      // token refreshes (which would wipe in-progress tab state).
      if (lastUserId.current !== data.id) {
        lastUserId.current = data.id
        setActiveTab('attendance')
        setView('portal')
      }
    })
    return () => { cancelled = true }
  }, [session])

  const logout = async () => {
    await supabase.auth.signOut()
    setView('home')
    setActiveTab('attendance')
  }

  if (!authReady) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Spinner size="lg" />
      </div>
    )
  }

  if (!user) {
    if (session) {
      if (profileError) {
        return (
          <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center gap-4 p-6 text-center">
            <p className="text-sm text-gray-600 max-w-sm">
              Signed in, but your member profile couldn't be loaded. Check your connection and reload, or sign out and try again.
            </p>
            <div className="flex gap-3">
              <button onClick={() => window.location.reload()}
                className="px-4 py-2 rounded-md bg-green-700 text-white text-sm font-semibold hover:bg-green-800 transition">Reload</button>
              <button onClick={logout}
                className="px-4 py-2 rounded-md border border-gray-300 text-sm font-semibold text-gray-700 hover:border-gray-500 transition">Sign Out</button>
            </div>
          </div>
        )
      }
      // Signed in, profile still loading.
      return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <Spinner size="lg" />
        </div>
      )
    }
    if (view === 'login') return <LoginPage onBack={() => setView('home')} />
    return <HomePage onLoginClick={() => setView('login')} />
  }

  // Signed in, but browsing the public site.
  if (view !== 'portal') {
    return <HomePage onLoginClick={() => setView('portal')} signedIn />
  }

  const activeRole = user.role

  return (
    <div className="flex flex-col md:flex-row min-h-screen bg-gray-50">
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} user={user} activeRole={activeRole} onLogout={logout} onHome={() => setView('home')} />

      <main className="flex-1 overflow-auto">
        <div className="p-4 sm:p-6 md:p-8 pb-24">
          {activeTab === 'attendance' && <AttendanceTab user={user} />}
          {activeTab === 'mentor'   && <MentorTab activeRole={activeRole} user={user} />}
          {activeTab === 'forms'    && <FormsTab />}
          {activeTab === 'research' && <ResearchTab activeRole={activeRole} user={user} />}
          {activeTab === 'support'  && <SupportTab user={user} activeRole={activeRole} />}
          {activeTab === 'roster'   && activeRole === 'admin' && <RosterTab />}
        </div>
      </main>
    </div>
  )
}
