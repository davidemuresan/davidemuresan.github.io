/* ==========================================================================
   content.js — ★ THE ONLY FILE YOU NEED TO EDIT FOR TEXT & LINKS ★
   --------------------------------------------------------------------------
   Every visible string lives here. Bilingual values use { en: '', ro: '' }.
   Plain strings (no object) are shown the same in both languages.
   Projects map 1:1 to the glowing "zones" on the 3D circuit board
   (order matters: 1st project → zone 1, …, max 4 zones).
   ========================================================================== */

export const site = {
  name: 'Davide-Andrei Mureșan',
  shortName: 'DM',
  location: 'Cluj-Napoca, Romania',
  email: 'davide.muresan2003@yahoo.com',
  links: {
    github: 'https://github.com/davideboss2003',
    linkedin: 'https://www.linkedin.com/in/davide-andrei-muresan-661b68334/',
    // File lives in /public/cv/. Replace it with a new PDF keeping the same name.
    cv: './cv/Davide-Muresan-CV.pdf',
  },
};

/* --- Navigation + small UI strings -------------------------------------- */
export const ui = {
  skip: { en: 'Skip to content', ro: 'Sari la conținut' },
  nav: {
    about: { en: 'About', ro: 'Despre' },
    projects: { en: 'Projects', ro: 'Proiecte' },
    skills: { en: 'Skills', ro: 'Competențe' },
    contact: { en: 'Contact', ro: 'Contact' },
  },
  langLabel: { en: ': switch language to Romanian', ro: ': schimbă limba în engleză' },
  scroll: { en: 'Scroll to enter the circuit', ro: 'Derulează ca să intri în circuit' },
  boot: { en: 'Powering the board', ro: 'Alimentez placa' },
  viewCode: { en: 'View code on GitHub', ro: 'Vezi codul pe GitHub' },
  privateRepo: { en: 'Thesis · code available on request', ro: 'Lucrare de licență · cod disponibil la cerere' },
  footer: {
    en: 'Designed & built by Davide-Andrei Mureșan · Procedural PCB rendered live with Three.js',
    ro: 'Proiectat și construit de Davide-Andrei Mureșan · PCB procedural randat live cu Three.js',
  },
};

/* --- 00 · Hero ----------------------------------------------------------- */
export const hero = {
  eyebrow: { en: 'Signal Path // Portfolio 2026', ro: 'Signal Path // Portofoliu 2026' },
  tagline: {
    en: 'Networks & AI engineer. I open systems up, follow the signal inside, and understand why every piece is there.',
    ro: 'Inginer de rețele și AI. Deschid sistemele, urmăresc semnalul din interior și înțeleg de ce e acolo fiecare piesă.',
  },
  status: {
    en: 'Open to first role · Networking · NOC · Cloud · DevOps',
    ro: 'Disponibil pentru primul job · Rețele · NOC · Cloud · DevOps',
  },
  ctaPrimary: { en: 'Explore projects', ro: 'Vezi proiectele' },
  ctaSecondary: { en: 'Download CV', ro: 'Descarcă CV' },
};

/* --- 01 · About ---------------------------------------------------------- */
export const about = {
  label: { en: '01 — About', ro: '01 — Despre mine' },
  title: { en: 'Curiosity is what moves me.', ro: 'Curiozitatea e cea care mă pune în mișcare.' },
  body: [
    {
      en: 'I want to know how things actually work: open them up, follow what happens inside and understand why each piece is there. That is what drew me to engineering, from packets crossing a campus network to neural networks reading a street at night.',
      ro: 'Vreau să știu cum funcționează lucrurile cu adevărat: să le deschid, să urmăresc ce se întâmplă înăuntru și să înțeleg de ce e acolo fiecare piesă. Asta m-a adus spre inginerie, de la pachetele care traversează o rețea de campus la rețelele neuronale care „citesc” o stradă noaptea.',
    },
    {
      en: 'I stay calm when things go wrong and go straight for a rational fix. I learn fast, I ask when I don’t understand, and I want to work next to people with more experience than mine.',
      ro: 'Rămân calm când ceva nu merge și caut imediat o soluție logică. Învăț repede, întreb când nu înțeleg și vreau să lucrez lângă oameni cu mai multă experiență decât mine.',
    },
  ],
  // Timeline — newest first
  timeline: [
    {
      when: { en: '2026 — Present', ro: '2026 — Prezent' },
      what: { en: 'MSc Communications Networks & Distributed Systems', ro: 'Master Rețele de Comunicații și Sisteme Distribuite' },
      where: 'UTCN · Cluj-Napoca',
      note: {
        en: 'Research: distributed pedestrian crossing-intent estimation over V2X vehicular networks: what is worth transmitting, and when, under limited bandwidth.',
        ro: 'Cercetare: estimarea distribuită a intenției pietonilor de a traversa, prin rețele vehiculare V2X: ce merită transmis și când, cu lățime de bandă limitată.',
      },
    },
    {
      when: 'Jul — Sep 2025',
      what: { en: 'IT Intern · Web, Mobile & Industrial Development', ro: 'Intern IT · Web, Mobile & Industrial Development' },
      where: 'Tenaris · Cluj-Napoca',
      note: {
        en: 'C# features for iControl, the plant’s production-scheduling platform, plus an AI assistant guiding users across web, mobile and industrial software. Full Agile cycle.',
        ro: 'Funcționalități C# pentru iControl, platforma de planificare a producției din fabrică, și un asistent AI care ghidează utilizatorii pe web, mobil și software industrial. Ciclu Agile complet.',
      },
    },
    {
      when: '2022 — 2026',
      what: { en: 'BSc Computer Science & Information Technology', ro: 'Licență Calculatoare și Tehnologia Informației' },
      where: 'UTCN · Cluj-Napoca',
      note: {
        en: 'Computer Networks, Communication Protocols, Control Systems, OS, Algorithms, AI. Thesis: SafeCross.',
        ro: 'Rețele de calculatoare, Protocoale de comunicație, Sisteme de control, SO, Algoritmi, AI. Licență: SafeCross.',
      },
    },
  ],
};

/* --- 02 · Projects (each one = a zone on the board) ---------------------- */
export const projectsIntro = {
  label: { en: '02 — Projects', ro: '02 — Proiecte' },
  title: { en: 'Four blocks on the board.', ro: 'Patru blocuri pe placă.' },
  sub: {
    en: 'Each project is a functional block of the circuit. Keep scrolling: the signal visits them one by one.',
    ro: 'Fiecare proiect e un bloc funcțional al circuitului. Derulează: semnalul le vizitează pe rând.',
  },
};

export const projects = [
  {
    ref: 'U2', // silkscreen reference shown on the card and on the board
    title: 'SafeCross',
    kind: { en: 'Bachelor’s thesis · Computer vision', ro: 'Lucrare de licență · Computer vision' },
    stack: ['Python', 'PyTorch', 'C++', 'TensorRT', 'RGB + Thermal'],
    description: {
      en: 'Driver-assistance system that predicts whether a pedestrian intends to cross. A pipeline of AI models (detection & segmentation, a custom body-orientation network and a classifier over tracked geometric features) running on RGB and thermal imagery, so it holds up at night as well as in daylight.',
      ro: 'Sistem de asistență pentru șofer care prezice dacă un pieton intenționează să traverseze. Un pipeline de modele AI (detecție și segmentare, o rețea proprie pentru orientarea corpului și un clasificator pe trăsături geometrice urmărite) pe imagini RGB și termice, ca să funcționeze și noaptea, nu doar ziua.',
    },
    metrics: [
      { value: '93%', label: { en: 'body-orientation accuracy', ro: 'acuratețe orientare corp' } },
      { value: '74→20 ms', label: { en: 'detection via C++ / TensorRT', ro: 'detecție prin C++ / TensorRT' } },
    ],
    github: null, // null = no public repo (shows "code available on request")
  },
  {
    ref: 'U3',
    title: { en: 'Three-Building Campus Network', ro: 'Rețea de campus pe trei clădiri' },
    kind: { en: 'Network design & automation', ro: 'Proiectare și automatizare de rețea' },
    stack: ['Cisco Packet Tracer', 'OSPF', 'VLAN / STP', 'Python', 'Jinja2', 'YAML', 'pytest', 'CI'],
    description: {
      en: 'A campus network across three sites: VLANs and Spanning Tree at Layer 2, OSPF at Layer 3, DHCP, WPA2 wireless and a DMZ for public services. Every device hardened with separate privilege levels and SSH-only management.',
      ro: 'O rețea de campus pe trei locații: VLAN-uri și Spanning Tree la nivelul 2, OSPF la nivelul 3, DHCP, wireless WPA2 și un DMZ pentru servicii publice. Fiecare echipament securizat cu niveluri de privilegii separate și management doar prin SSH.',
    },
    metrics: [
      { value: '2/3', label: { en: 'of configs generated from YAML + Jinja2', ro: 'din configurații generate din YAML + Jinja2' } },
      { value: 'CI', label: { en: 'automated pytest verification', ro: 'verificare automată cu pytest' } },
    ],
    github: 'https://github.com/davideboss2003/Full-Network-configuration-automatization-',
  },
  {
    ref: 'U4',
    title: 'TalentMatch',
    kind: { en: '2nd place · AI Hackathon by Accesa', ro: 'Locul 2 · AI Hackathon by Accesa' },
    stack: ['Python', 'Java', 'Angular', 'Azure', 'Gemini API'],
    description: {
      en: 'Web app that helps recruiters match CVs against job descriptions, combining semantic similarity with explicit rules. I coordinated the four-person team, built the CV-parsing pipeline on the Gemini API, implemented two of the three scoring components and connected the Azure services.',
      ro: 'Aplicație web care îi ajută pe recruiteri să potrivească CV-uri cu descrieri de job, combinând similaritatea semantică cu reguli explicite. Am coordonat echipa de patru, am construit pipeline-ul de parsare a CV-urilor pe Gemini API, am implementat două din cele trei componente de scoring și am conectat serviciile Azure.',
    },
    metrics: [
      { value: '2nd', label: { en: 'place at the Accesa AI Hackathon', ro: 'loc la AI Hackathon by Accesa' } },
      { value: '4', label: { en: 'person team, coordinated by me', ro: 'membri în echipă, coordonată de mine' } },
    ],
    github: 'https://github.com/davideboss2003/SixthSense',
  },
  {
    ref: 'U5',
    title: { en: 'Communication Protocols on FPGA', ro: 'Protocoale de comunicație pe FPGA' },
    kind: { en: 'Digital design · Hardware', ro: 'Proiectare digitală · Hardware' },
    stack: ['VHDL', 'Vivado', 'FSM', 'Simulation'],
    description: {
      en: 'I²C, SPI and Ethernet implemented from the specification in VHDL: a transmitter and a receiver for each, driven by finite state machines and verified in simulation.',
      ro: 'I²C, SPI și Ethernet implementate în VHDL pornind de la specificație: un transmițător și un receptor pentru fiecare, conduse de automate cu stări finite și verificate în simulare.',
    },
    metrics: [
      { value: '3', label: { en: 'protocols from spec: I²C · SPI · ETH', ro: 'protocoale din specificație: I²C · SPI · ETH' } },
      { value: 'TX+RX', label: { en: 'for every protocol', ro: 'pentru fiecare protocol' } },
    ],
    github: 'https://github.com/davideboss2003/Communications-protocols',
  },
];

/* --- 03 · Skills (4 "ports" of the chip) --------------------------------- */
export const skills = {
  label: { en: '03 — Skills', ro: '03 — Competențe' },
  title: { en: 'The pinout.', ro: 'Pinout-ul.' },
  groups: [
    {
      port: 'PORT A',
      name: { en: 'Networking', ro: 'Rețelistică' },
      items: ['TCP/IP', 'IPv4/IPv6 subnetting', 'VLAN · inter-VLAN', 'STP', 'EtherChannel', 'HSRP', 'OSPF', 'ACL', 'NAT/PAT', 'DHCP · DNS', 'Cisco IOS CLI'],
    },
    {
      port: 'PORT B',
      name: { en: 'AI / ML', ro: 'AI / ML' },
      items: ['PyTorch', 'OpenCV', 'YOLO / CNN', 'ONNX', 'TensorRT', 'FastAPI'],
    },
    {
      port: 'PORT C',
      name: { en: 'Programming', ro: 'Programare' },
      items: ['Python', 'C / C++', 'C#', 'Java', 'SQL', 'Bash', 'VHDL', 'x86 ASM', 'Spring Boot', 'Angular', '.NET'],
    },
    {
      port: 'PORT D',
      name: { en: 'Systems & DevOps', ro: 'Sisteme & DevOps' },
      items: ['Linux (Ubuntu)', 'Windows', 'Git', 'GitHub Actions', 'CI pipelines', 'Jinja2 · YAML', 'pytest', 'Azure'],
    },
  ],
  certsTitle: { en: 'Certifications', ro: 'Certificări' },
  certs: [
    { en: 'Cisco CCNA 1: Introduction to Networks', ro: 'Cisco CCNA 1: Introduction to Networks' },
    { en: 'Cisco CCNA 2: Switching, Routing & Wireless', ro: 'Cisco CCNA 2: Switching, Routing & Wireless' },
    { en: 'CCNA 3 · in progress', ro: 'CCNA 3 · în curs' },
    { en: 'Cambridge Advanced (CAE) · English C1', ro: 'Cambridge Advanced (CAE) · Engleză C1' },
  ],
  langsTitle: { en: 'Languages', ro: 'Limbi' },
  langs: [
    { en: 'Romanian · native', ro: 'Română · nativ' },
    { en: 'Italian · native', ro: 'Italiană · nativ' },
    { en: 'English · C1', ro: 'Engleză · C1' },
  ],
};

/* --- 04 · Contact -------------------------------------------------------- */
export const contact = {
  label: { en: '04 — Contact', ro: '04 — Contact' },
  title: { en: 'Let’s route something together.', ro: 'Hai să rutăm ceva împreună.' },
  body: {
    en: 'I’m looking for my first IT role or internship in networking, NOC, cloud or DevOps. If your team ships packets, pipelines or models, I’d love to hear from you.',
    ro: 'Caut primul meu job sau internship în IT: rețele, NOC, cloud sau DevOps. Dacă echipa ta lucrează cu pachete, pipeline-uri sau modele, aș fi bucuros să vorbim.',
  },
  emailLabel: { en: 'Write me an email', ro: 'Scrie-mi un email' },
  cvLabel: { en: 'Download CV (PDF)', ro: 'Descarcă CV (PDF)' },
};
