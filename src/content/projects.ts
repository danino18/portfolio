/**
 * Project content. Everything the site says about a project lives here —
 * edit this file to change copy, links, status labels or the honest
 * implemented / in-progress / goal breakdown on each case-study page.
 * Never add a repository or live URL that does not exist: leave `links` empty instead.
 */

export type ProjectKind = "dart" | "planner" | "maze" | "arm" | "explorations";

export type ProjectStatus = "ongoing-research" | "project" | "workshop" | "exploratory";

export type FactState = "built" | "in-progress" | "direction" | "exploratory" | "illustrative";

export interface ProjectFact {
  state: FactState;
  text: string;
}

export interface ProjectLink {
  label: string;
  href: string;
}

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
    statusLabel: "Web application",
    summary:
      "An interactive academic degree-planning application for Technion engineering students.",
    description: [
      "Planning a degree means juggling prerequisites, credit points, specialization tracks and a GPA, usually in a spreadsheet. The Degree Planner models those rules explicitly so the plan itself can tell you when something does not add up.",
      "Students lay out semesters with drag-and-drop, see how courses depend on each other, track specialization progress, calculate their GPA, check the plan against degree requirements, keep multiple plans and share them.",
      "The interesting engineering is the rule model: prerequisites and requirement groups have to compose without turning every new rule into a special case, while the interface stays fast and obvious.",
    ],
    topics: [
      "Semester drag-and-drop planning",
      "Course prerequisites",
      "Specialization tracking",
      "GPA calculation",
      "Degree requirement validation",
      "Multiple plans and sharing",
    ],
    stack: ["Web application"],
    accent: { a: "#9b7bff", b: "#e4d9ff" },
    links: [],
    facts: [
      { state: "built", text: "Semester planning with drag-and-drop." },
      { state: "built", text: "Course prerequisites, specialization tracking and GPA calculation." },
      { state: "built", text: "Degree requirement validation, multiple plans and plan sharing." },
      { state: "illustrative", text: "The graph and planner on this site use made-up sample courses and grades, not real Technion data." },
    ],
    demoNote: "Interactive sample — made-up courses and grades, not real Technion data.",
    interaction: "Switch between graph and planner, then drag a course into another semester.",
  },
  {
    slug: "controlled-maze-fpga",
    kind: "maze",
    index: "03",
    title: "Controlled Maze FPGA Game",
    titleLines: ["MAZE", "FPGA"],
    tagline: "A maze game, drawn pixel by pixel by logic you can point at.",
    status: "project",
    statusLabel: "Hardware project",
    summary:
      "A game built on an Intel/Altera Cyclone V FPGA development board using SystemVerilog, VGA output, PS/2 keyboard input and finite-state machines.",
    description: [
      "There is no CPU and no frame buffer to hide behind. The picture is produced by hardware that knows, on every pixel clock, what color the next pixel should be. The keyboard arrives as a PS/2 bit stream, and the game rules live in finite-state machines.",
      "The design targets an Intel/Altera Cyclone V development board and is written in SystemVerilog, with simulation and tooling alongside the FPGA sources in the repository.",
      "The playable maze on this page is a lightweight web approximation of the idea. It is not the original FPGA implementation.",
    ],
    topics: ["SystemVerilog", "VGA output", "PS/2 keyboard interface", "Finite-state machines", "Cyclone V FPGA"],
    stack: ["SystemVerilog", "Intel/Altera Cyclone V", "VGA", "PS/2"],
    accent: { a: "#7dff9a", b: "#38e8ff" },
    links: [{ label: "GitHub repository", href: "https://github.com/danino18/basic_controled_mazed" }],
    facts: [
      { state: "built", text: "Maze game on a Cyclone V FPGA board, written in SystemVerilog." },
      { state: "built", text: "VGA output and PS/2 keyboard interaction driven by finite-state machines." },
      { state: "illustrative", text: "The playable game here is a web demo approximating the concept, not the FPGA design." },
    ],
    demoNote: "Web demo — an approximation, not the original FPGA implementation.",
    interaction: "Click the screen, then use arrow keys or WASD (or the on-screen pad) to reach the exit.",
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
      "The repository documents a ROS 2 stack where task planning, state estimation, motion planning and manipulation skills are separate, readable layers, and the same programs target both a Gazebo simulation and the real robot cell.",
      "The block-stacking arm on this page is an illustrative 3D visualization built for this site. It does not play back robot data.",
    ],
    topics: ["UR5e", "OnRobot RG6 gripper", "Intel RealSense", "ROS 2", "Robot perception", "Manipulation"],
    stack: ["ROS 2", "Python", "UR5e", "OnRobot RG6", "Intel RealSense"],
    accent: { a: "#ff8a3d", b: "#9fb4d0" },
    links: [{ label: "GitHub repository", href: "https://github.com/danino18/physAI-arm-ex" }],
    facts: [
      { state: "built", text: "Workshop codebase for a UR5e + RG6 + RealSense pick-and-place cell, documented in the repository." },
      { state: "built", text: "Layered structure: task planning, state estimation, motion planning and manipulation skills." },
      { state: "built", text: "The same programs target a Gazebo simulation and the real robot." },
      { state: "illustrative", text: "The 3D arm and block stacking here are an original visualization, not footage or logs from the robot." },
    ],
    demoNote: "Illustrative 3D visualization — not robot data. Inverse kinematics is solved live in your browser.",
    interaction: "Drag to orbit the cell. Switch to manual mode to move the tool yourself.",
  },
  {
    slug: "advanced-explorations",
    kind: "explorations",
    index: "05",
    title: "Advanced Explorations",
    titleLines: ["ADVANCED", "EXPLORATIONS"],
    tagline: "Questions I am still working out, shown as experiments.",
    status: "exploratory",
    statusLabel: "Exploratory",
    summary:
      "Ongoing explorations in household robotics, Wi-Fi channel-state sensing and electronic-nose sensor arrays.",
    description: [
      "Three directions that interest me and that I am still exploring: robots that handle soft, deformable things like laundry; using the channel-state information of a cheap ESP32 Wi-Fi radio to sense motion indoors; and arrays of gas sensors combined with machine learning, an electronic nose.",
      "These are explorations, not finished products. There are no claimed results here. Each visual is a toy simulation that illustrates the underlying idea, and is labeled that way.",
    ],
    topics: ["Household robotics", "Deformable-object manipulation", "ESP32 Wi-Fi CSI sensing", "Indoor motion detection", "Sensor arrays", "Machine learning"],
    stack: ["Robotics", "ESP32", "Sensor arrays", "Machine learning"],
    accent: { a: "#ff6bd6", b: "#7fe8ff" },
    links: [],
    facts: [
      { state: "exploratory", text: "Robotic laundry manipulation and household robotics." },
      { state: "exploratory", text: "ESP32 Wi-Fi channel-state sensing for indoor motion detection." },
      { state: "exploratory", text: "Electronic-nose sensor arrays and AI." },
      { state: "illustrative", text: "All three visuals are toy simulations of the concept. They are not measurements or results." },
    ],
    demoNote: "Toy simulations of the concepts — not measurements or results.",
    interaction: "Pick an experiment: drag the cloth, wave through the room, or swap the odor.",
  },
];

export const getProject = (slug: string) => projects.find((p) => p.slug === slug);

export const getAdjacent = (slug: string) => {
  const i = projects.findIndex((p) => p.slug === slug);
  return {
    prev: projects[(i - 1 + projects.length) % projects.length],
    next: projects[(i + 1) % projects.length],
  };
};
