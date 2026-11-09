/**
 * Project content. Everything the site says about a project lives here —
 * edit this file to change copy, links, status labels or the honest
 * implemented / in-progress / goal breakdown on each case-study page.
 * Never add a repository or live URL that does not exist: leave `links` empty instead.
 */

export type ProjectKind = "dart" | "planner" | "maze" | "arm" | "reef" | "wifi";

export type ProjectStatus = "ongoing-research" | "project" | "workshop" | "service" | "exploratory";

export type FactState = "built" | "in-progress" | "direction" | "exploratory" | "illustrative";

export interface ProjectFact {
  state: FactState;
  text: string;
}

/**
 * An outbound link. Only add one when the destination has been checked to
 * exist and to be the right project; `verified` records how.
 */
export type ProjectLinkKind = "live" | "github" | "video";

export interface ProjectLink {
  kind: ProjectLinkKind;
  label: string;
  href: string;
  /** How/when the URL was verified (kept in the data, not rendered). */
  verified: string;
}

/** Real footage/media for a project (never generated or placeholder footage). */
export type ProjectMedia =
  | {
      kind: "youtube";
      /** YouTube video id. */
      id: string;
      title: string;
      /** Width / height. Shorts are 9/16. */
      aspect: number;
      caption: string;
      /** Public watch URL, also used as the no-JS / blocked-embed fallback. */
      url: string;
    }
  | {
      kind: "file";
      /** Files live in /public/media/<slug>/ (e.g. arm.mp4 + arm.webm + arm-poster.jpg). */
      sources: { src: string; type: string }[];
      poster: string;
      title: string;
      aspect: number;
      caption: string;
      loop?: boolean;
    };

export interface Project {
  slug: string;
  kind: ProjectKind;
  index: string;
  title: string;
  titleLines: string[];
  tagline: string;
  status: ProjectStatus;
  statusLabel: string;
  summary: string;
  description: string[];
  topics: string[];
  stack: string[];
  accent: { a: string; b: string };
  links: ProjectLink[];
  /** Real footage, shown next to the interactive visual. */
  media?: ProjectMedia;
  /** Collaborators / context, shown on the case-study page. */
  credit?: string;
  facts: ProjectFact[];
  /** Short honest disclaimer shown next to the interactive visual. */
  demoNote: string;
  /** Hint for the primary interaction. */
  interaction: string;
}

export const factLabels: Record<FactState, string> = {
  built: "Documented",
  "in-progress": "In progress",
  direction: "Research direction",
  exploratory: "Exploratory",
  illustrative: "Illustrative only",
};

export const projects: Project[] = [
  {
    slug: "dart-cuda",
    kind: "dart",
    index: "01",
    title: "DART-CUDA Genomic Mapper",
    titleLines: ["DART", "CUDA"],
    tagline: "Short-read mapping, rethought for thousands of GPU threads.",
    status: "ongoing-research",
    statusLabel: "Ongoing research",
    summary:
      "A research-oriented CUDA project exploring GPU acceleration of genomic short-read mapping, inspired by DART-PIM.",
    description: [
      "Short-read mapping is a memory-bound search problem: millions of small reads have to find their place in a very large reference. DART-PIM approaches it by moving work close to memory. This project asks what the same problem looks like on a GPU, where the challenge becomes keeping thousands of threads fed with coherent, memory-efficient work.",
      "The work centers on GPU kernel design, genomic indexing, sequence alignment and careful profiling, with the intention of comparing against established pipelines such as NVIDIA Parabricks and BWA-MEM2 once correctness is nailed down.",
      "This is active research. No benchmark numbers or results are published here, and none are implied.",
    ],
    topics: [
      "GPU kernels",
      "Sequence alignment",
      "Genomic indexing",
      "Memory-efficient computation",
      "Performance profiling",
      "Correctness validation",
    ],
    stack: ["CUDA", "C/C++"],
    accent: { a: "#38e8ff", b: "#5df0c0" },
    links: [],
    facts: [
      { state: "in-progress", text: "GPU-accelerated short-read mapping in CUDA, inspired by DART-PIM." },
      { state: "direction", text: "Memory-efficient genomic indexing suited to GPU access patterns." },
      { state: "direction", text: "Correctness validation against reference aligners before any performance claim." },
      { state: "direction", text: "Comparison with NVIDIA Parabricks and BWA-MEM2 as established baselines." },
      { state: "illustrative", text: "The animation on this site is a conceptual visualization, not real mapper output." },
    ],
    demoNote: "Conceptual visualization — not real mapper output or measured data.",
    interaction: "Drag the slider or press the button to turn the helix into a thread grid.",
  },
  {
    slug: "degree-planner",
    kind: "planner",
    index: "02",
    title: "Technion Degree Planner",
    titleLines: ["DEGREE", "PLANNER"],
    tagline: "A prerequisite graph that becomes a semester plan.",
    status: "project",
    statusLabel: "Live web application",
    summary:
      "ee-planer: an interactive degree-planning and requirements-validation app for Technion Electrical & Computer Engineering students, deployed as a live pilot.",
    description: [
      "Planning a degree means juggling prerequisites, credit points, specialization groups, minors and a GPA, usually in a spreadsheet. ee-planer models those rules explicitly so the plan itself can tell you when something does not add up.",
      "Students lay out semesters with drag-and-drop, see how courses depend on each other, track specialization and minor progress, enter grades or import a transcript, keep several plan versions side by side and check the plan against the degree requirements of their track and catalog year.",
      "The interesting engineering is the rule model: prerequisites, requirement groups and catalog-year variants have to compose as data and pure functions, so they can be unit-tested, while the interface stays fast and obvious. It was built as a Technion ECE final project and runs as a pilot at ee-planer.vercel.app.",
    ],
    topics: [
      "Semester drag-and-drop planning",
      "Course prerequisites",
      "Specialization groups & minors",
      "GPA & transcript import",
      "Degree requirement validation",
      "Plan versions and sharing",
    ],
    stack: ["React 19", "TypeScript", "Vite", "Tailwind CSS", "Zustand", "dnd-kit", "Firebase", "Vercel"],
    accent: { a: "#9b7bff", b: "#e4d9ff" },
    links: [
      {
        kind: "live",
        label: "Visit live website",
        href: "https://ee-planer.vercel.app",
        verified: "2026-11-09: HTTP 200 from the Vercel project ee-planer (title “מתכנן לימודים – הטכניון”); named as the pilot deployment in the project's docs/deploy.md and final report. Source repository is private.",
      },
    ],
    credit: "Technion ECE final project (Spring 2026) with Dvir Bartov and Gal Siegel, supervised by Hovav Gazit.",
    facts: [
      { state: "built", text: "Live pilot at ee-planer.vercel.app: drag-and-drop semester planning with real-time requirement validation." },
      { state: "built", text: "Six ECE tracks and catalog years 2021–2027, 73 specialization-group definitions and 3 minors (per the final project report)." },
      { state: "built", text: "Rule engines as pure functions with 31 automated test files, run in CI on every push and pull request." },
      { state: "built", text: "Firebase Auth and Firestore sync, plan versions with side-by-side comparison, plan sharing and transcript import." },
      { state: "built", text: "More than 210 registered users during the pilot, as reported in the final project report (October 2026)." },
      { state: "illustrative", text: "The graph and planner on this site use made-up sample courses and grades, not real Technion data — the live site is the real application." },
    ],
    demoNote: "Interactive sample — made-up courses and grades. The real application is on the live website.",
    interaction: "Switch between graph and planner, then drag a course into another semester.",
  },
  {
    slug: "controlled-maze-fpga",
    kind: "maze",
    index: "03",
    title: "Controlled Maze FPGA Game",
    titleLines: ["MAZE", "FPGA"],
    tagline: "Flappy Bird, inverted: you steer the coral, not the bird.",
    status: "project",
    statusLabel: "Hardware project",
    summary:
      "An underwater Flappy-Bird-style game in SystemVerilog on an Intel Cyclone V board: the bird flies by itself, and the player moves the openings in the coral columns so it can pass. VGA video, PS/2 keyboard, sound, and an AI player trained on the FPGA itself.",
    description: [
      "The twist is the control scheme. The bird is autonomous: it holds a fixed horizontal position and moves vertically on its own, following a smooth, random or pursuit trajectory depending on the difficulty. The player never touches the bird. Holding the up or down arrow moves one shared offset that shifts the openings of all coral columns together, and the job is to keep the gap lined up with the bird as the columns scroll past.",
      "There is no CPU and no frame buffer. Every pixel of the 640×480 VGA picture is chosen by hardware on its pixel clock, from a procedural water gradient, sprite ROMs for the bird and coral, and a text layer. The PS/2 keyboard, the game state machine, the geometric collision check and the score all run as synchronous logic on one 31.5 MHz clock.",
      "On top of the game, the repository documents an AI mode: a small neural network trained on the FPGA by a genetic algorithm, evaluating eight candidates in parallel with the same game-rule modules the player uses, then playing the normal game.",
      "The playable version on this page is a browser approximation that reuses the project's own sprite art and rules. It is not the SystemVerilog implementation.",
    ],
    topics: ["SystemVerilog", "VGA 640×480", "PS/2 keyboard", "Finite-state machines", "Sprite ROMs", "On-FPGA genetic algorithm"],
    stack: ["SystemVerilog", "Intel Cyclone V", "Quartus Prime", "ModelSim", "VGA", "PS/2"],
    accent: { a: "#7dff9a", b: "#38e8ff" },
    links: [
      {
        kind: "github",
        label: "View on GitHub",
        href: "https://github.com/danino18/basic_controled_mazed",
        verified: "2026-11-09: public repository, cloned and read (docs/DESIGN.md, fpga/RTL, assets/sprites).",
      },
    ],
    facts: [
      { state: "built", text: "The bird moves only vertically at a fixed x; the player holds ↑/↓ to move every coral opening together. +1 point per column passed." },
      { state: "built", text: "Three difficulty modes change only the bird's trajectory generator (sine, random turns, rate-limited pursuit)." },
      { state: "built", text: "VGA output at ~72.6 frames/s, PS/2 arrow keys, geometric hitboxes, score and best score on VGA and 7-segment displays, sound effects." },
      { state: "built", text: "AI mode documented in the repository: a 4→6→1 network trained on the FPGA by a genetic algorithm over eight parallel game lanes." },
      { state: "illustrative", text: "The playable game here is a browser approximation using the project's sprite art; its AI autopilot is a simple controller, not the trained network." },
    ],
    demoNote: "Browser approximation of the FPGA game — the project's own sprite art, not the SystemVerilog design.",
    interaction: "Hold ↑/↓ or W/S — or press the top/bottom of the screen — to move the coral openings. The bird flies on its own.",
  },
  {
    slug: "physical-ai-robot-arm",
    kind: "arm",
    index: "04",
    title: "Physical AI Robotic Arm",
    titleLines: ["PHYSICAL", "AI ARM"],
    tagline: "A UR5e that has to see before it moves.",
    status: "workshop",
    statusLabel: "Technion Physical AI workshop",
    summary:
      "Robotics work with a UR5e arm, an OnRobot RG6 gripper and an Intel RealSense camera on ROS 2, associated with a Technion Physical AI workshop.",
    description: [
      "The workshop setup combines a UR5e robot arm, an OnRobot RG6 gripper and a wrist-mounted Intel RealSense camera. The arm looks at a workspace, works out where things are, plans a collision-free motion and manipulates objects.",
      "The repository documents a ROS 2 stack where task planning, state estimation, motion planning and manipulation skills are separate, readable layers: items are recognised with SAM 3, grasps are chosen, collision-free motions are planned with MoveIt, and a goal can be handed to a task planner. The same programs target both a Gazebo simulation and the real robot cell.",
      "The video on this page is real footage of the cell. The block-stacking arm next to it is an illustrative 3D visualization built for this site; it does not play back robot data.",
    ],
    topics: ["UR5e", "OnRobot RG6 gripper", "Intel RealSense", "ROS 2", "Robot perception", "Manipulation"],
    stack: ["ROS 2", "Python", "MoveIt", "Gazebo", "SAM 3", "UR5e", "OnRobot RG6", "Intel RealSense"],
    accent: { a: "#ff8a3d", b: "#9fb4d0" },
    links: [
      {
        kind: "github",
        label: "View on GitHub",
        href: "https://github.com/danino18/physAI-arm-ex",
        verified: "2026-11-09: public repository (a fork of the workshop repository), cloned and README read.",
      },
      {
        kind: "video",
        label: "Watch on YouTube",
        href: "https://youtube.com/shorts/yq8GpWCdJY8",
        verified: "Provided by Eyal on 2026-11-09 as the video of the robot cell in operation.",
      },
    ],
    media: {
      kind: "youtube",
      id: "yq8GpWCdJY8",
      title: "Physical AI robotic arm in operation",
      aspect: 9 / 16,
      caption: "Real footage of the robot cell in operation.",
      url: "https://youtube.com/shorts/yq8GpWCdJY8",
    },
    facts: [
      { state: "built", text: "Real footage of the cell in operation is embedded on this page (YouTube)." },
      { state: "built", text: "Workshop codebase for a UR5e + RG6 + RealSense pick-and-place cell, documented in the repository." },
      { state: "built", text: "Layered structure: task planning, state estimation, motion planning and manipulation skills." },
      { state: "built", text: "The same programs target a Gazebo simulation and the real robot." },
      { state: "illustrative", text: "The 3D arm and block stacking here are an original visualization, not footage or logs from the robot." },
    ],
    demoNote: "Illustrative 3D visualization — not robot data. Inverse kinematics is solved live in your browser.",
    interaction: "Drag to orbit the cell. Switch to manual mode to move the tool yourself.",
  },
  {
    slug: "navy-reef",
    kind: "reef",
    index: "05",
    title: "The Reef: Israeli Navy Innovation Accelerator",
    titleLines: ["THE REEF", "NAVY"],
    tagline: "A startup accelerator inside the Navy, for the people who serve in it.",
    status: "service",
    statusLabel: "Military service · Innovation officer",
    summary:
      "In the army I served as an innovation officer in a technological unit. There I founded and commanded “The Reef” (הריף), the Israeli Navy's innovation accelerator: service members take an operational, technological or organizational challenge from idea to MVP and an in-house prototype.",
    description: [
      "The Reef is an excellence and innovation program of the Israeli Navy. Its aim is to grow its participants' ability to lead change and to give them entrepreneurial skills, so that ideas from inside the Navy can move it forward.",
      "The accelerator connects strategic challenges with breakthrough products available on the market, for integration. Challenges come from two directions: bottom-up initiatives from across the Navy and top-down challenges from senior command. Each selected challenge is worked toward an MVP, an in-house prototype demonstrator and, when it is mature enough, a full development project.",
      "Challenges are screened by their impact on the Navy and the IDF, their fit for fast, small-scale procurement, how many people they affect, how certain the demand is and how feasible the technology is. Selected teams then learn inventive and systematic thinking, teamwork, market research and customer interviews, business modelling, flow charts and user experience, MVP planning, risk management and Lean Product Design, and finally pitch to a “shark tank” of senior officers from the receiving unit and the Navy's senior command.",
      "Every team combines a Champion who owns the need from the field, a Maker (CTO) with hands-on technical skills, a team lead (CEO) and a program manager (PMO), supported by mentors including Navy alumni from Israeli tech.",
      "“I founded the Reef because I wanted every service member in the Navy to be able to go through an entrepreneurial journey, to express themselves and to make a meaningful contribution to the Navy and to Israel's security.” (translated from the program site)",
    ],
    topics: ["Innovation program design", "Lean Startup", "Lean Product Design", "MVP & prototyping", "Shark-tank pitching", "Team building", "Mentor network"],
    stack: ["Leadership", "Lean Startup", "Lean Product Design", "Product discovery", "MVP"],
    accent: { a: "#ffcf5a", b: "#3ec7ff" },
    links: [
      {
        kind: "live",
        label: "Visit program website",
        href: "https://navyreef.netlify.app",
        verified:
          "2026-11-09: HTTP 200; the page names Eyal Danino as founder and commander of the Reef. Content of this case study is taken from it. The website itself was built by team member Shon Koniavsky.",
      },
    ],
    credit: "Run with a team and mentors listed on the program site. The program website was built by the Reef's maker, Shon Koniavsky.",
    facts: [
      { state: "built", text: "Innovation officer in a technological unit during military service." },
      { state: "built", text: "Founder and commander of the Reef, the Israeli Navy's innovation accelerator (per the program site)." },
      { state: "built", text: "Program stages: challenge intake (bottom-up and top-down), screening, acceleration (Lean Startup, LPD, MVP) and a shark-tank pitch to senior command." },
      { state: "built", text: "Teams of Champion, Maker (CTO), team lead (CEO) and program manager (PMO), supported by mentors." },
      { state: "built", text: "Also created the podcast “Ratzim Kadima — the path for young entrepreneurs” (per the program site)." },
      { state: "illustrative", text: "The animation shows the program's process as described on its site. No real challenges, units or projects are shown." },
    ],
    demoNote: "Illustrative diagram of the program's process — no real challenges, units or projects.",
    interaction: "Watch ideas flow from challenge to MVP, or pick a stage to read what happens there.",
  },
  {
    slug: "wifi-sensing",
    kind: "wifi",
    index: "06",
    title: "Wi-Fi Sensing: Human Detection Using ESP32 and AI",
    titleLines: ["WI-FI", "SENSING"],
    tagline: "Can the Wi-Fi already in a room tell where a person is?",
    status: "exploratory",
    statusLabel: "Future project · experimental",
    summary:
      "A future project exploring indoor human motion detection and localization from Wi-Fi channel state information (CSI), using ESP32 devices and machine learning.",
    description: [
      "Every Wi-Fi packet carries channel state information (CSI): how each subcarrier's amplitude and phase were changed by the room on the way. A person moving through the room changes those reflections. The project explores whether ESP32 devices and machine learning can turn CSI into indoor motion detection and localization.",
      "The long-term research goal is to explore whether Wi-Fi signals can help reconstruct more about a person: position, movement, and potentially body shape. That is a research question, not a result.",
      "This is future and experimental work, not a finished product. Nothing here is a validated system and there are no claimed results. The visual is a conceptual research visualization with simulated signals, and is labeled that way.",
    ],
    topics: ["ESP32 Wi-Fi CSI sensing", "Indoor motion detection", "Localization", "Signal processing", "Machine learning"],
    stack: ["ESP32", "Wi-Fi CSI", "Machine learning"],
    accent: { a: "#ff6bd6", b: "#7fe8ff" },
    links: [],
    facts: [
      { state: "exploratory", text: "Wi-Fi Sensing: human detection using ESP32 devices and AI — indoor motion detection and localization from channel state information." },
      { state: "direction", text: "Long-term research goal: whether Wi-Fi signals can help estimate position, movement and potentially body shape." },
      { state: "illustrative", text: "The visual is a conceptual research visualization with simulated signals. It is not a measurement or a result." },
    ],
    demoNote: "Conceptual research visualization — simulated signals, not measurements or a validated system.",
    interaction: "Move the pointer (or tap) in the room to guide the person and watch the pipeline react.",
  },
];

export const getProject = (slug: string) => projects.find((p) => p.slug === slug);

export const linkByKind = (p: Project, kind: ProjectLinkKind) => p.links.find((l) => l.kind === kind);

export const getAdjacent = (slug: string) => {
  const i = projects.findIndex((p) => p.slug === slug);
  return {
    prev: projects[(i - 1 + projects.length) % projects.length],
    next: projects[(i + 1) % projects.length],
  };
};
