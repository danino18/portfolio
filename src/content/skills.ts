/**
 * Technical universe graph. Nodes are topics, not skill ratings: no levels,
 * no certificates. `projects` lists the project slugs where the topic appears.
 */
export type SkillGroup = "compute" | "hardware" | "software" | "robotics" | "people";

export interface SkillNode {
  id: string;
  label: string;
  group: SkillGroup;
  blurb: string;
  projects: string[];
  /** Desktop position in a 100x60 field. */
  d: [number, number];
  /** Mobile position in a 60x100 field. */
  m: [number, number];
}

export const skillNodes: SkillNode[] = [
  { id: "cuda", label: "CUDA", group: "compute", blurb: "Writing GPU kernels and thinking in warps, blocks and memory transactions.", projects: ["dart-cuda"], d: [24, 16], m: [12, 7] },
  { id: "gpu", label: "GPU Architecture", group: "compute", blurb: "How SMs, caches and memory bandwidth shape what a kernel can actually achieve.", projects: ["dart-cuda"], d: [10, 31], m: [12, 19] },
  { id: "perf", label: "Performance Engineering", group: "compute", blurb: "Profiling first, then optimizing the bottleneck that is really there.", projects: ["dart-cuda"], d: [27, 47], m: [12, 40] },
  { id: "cpp", label: "C/C++", group: "software", blurb: "Systems-level code close to the hardware.", projects: ["dart-cuda"], d: [42, 27], m: [30, 31] },
  { id: "python", label: "Python", group: "software", blurb: "Glue, tooling and robotics work.", projects: ["physical-ai-robot-arm"], d: [60, 11], m: [48, 12] },
  { id: "software", label: "Software Systems", group: "software", blurb: "Application architecture and rule modeling for products people use.", projects: ["degree-planner", "dart-cuda", "physical-ai-robot-arm"], d: [46, 49], m: [30, 49] },
  { id: "arch", label: "Computer Architecture", group: "hardware", blurb: "The contract between hardware and software.", projects: ["dart-cuda", "controlled-maze-fpga"], d: [57, 33], m: [12, 58] },
  { id: "digital", label: "Digital Design", group: "hardware", blurb: "Combinational and sequential logic, timing and state machines.", projects: ["controlled-maze-fpga"], d: [75, 42], m: [48, 66] },
  { id: "sv", label: "SystemVerilog", group: "hardware", blurb: "Describing hardware that runs on an FPGA.", projects: ["controlled-maze-fpga"], d: [89, 28], m: [12, 74] },
  { id: "fpga", label: "FPGA", group: "hardware", blurb: "Cyclone V board, VGA output and PS/2 input.", projects: ["controlled-maze-fpga"], d: [86, 51], m: [48, 82] },
  { id: "ros2", label: "ROS 2", group: "robotics", blurb: "The middleware that connects perception, planning and the arm.", projects: ["physical-ai-robot-arm"], d: [73, 17], m: [48, 24] },
  { id: "robotics", label: "Robotics", group: "robotics", blurb: "Robot arms, grippers and perception-driven manipulation.", projects: ["physical-ai-robot-arm"], d: [89, 9], m: [48, 37] },
  { id: "ai", label: "AI", group: "robotics", blurb: "Perception and learning where they meet the physical world.", projects: ["physical-ai-robot-arm", "wifi-sensing"], d: [66, 53], m: [50, 44] },
  { id: "esp32", label: "ESP32 & Wi-Fi CSI", group: "hardware", blurb: "Cheap radios as sensors: channel state information as a signal.", projects: ["wifi-sensing"], d: [52, 18], m: [30, 64] },
  { id: "innovation", label: "Innovation & Leadership", group: "people", blurb: "Founding and running a military innovation accelerator: from a field need to an MVP.", projects: ["navy-reef"], d: [36, 6], m: [30, 84] },
];

/** Edges between topics. */
export const skillEdges: [string, string][] = [
  ["cuda", "gpu"],
  ["cuda", "cpp"],
  ["cuda", "perf"],
  ["gpu", "arch"],
  ["gpu", "perf"],
  ["cpp", "arch"],
  ["cpp", "software"],
  ["arch", "digital"],
  ["digital", "sv"],
  ["sv", "fpga"],
  ["digital", "fpga"],
  ["python", "ros2"],
  ["python", "ai"],
  ["ros2", "robotics"],
  ["robotics", "ai"],
  ["software", "ai"],
  ["perf", "software"],
  ["esp32", "ai"],
  ["esp32", "digital"],
  ["innovation", "software"],
];

export const groupColor: Record<SkillGroup, string> = {
  compute: "#38e8ff",
  hardware: "#7dff9a",
  software: "#e4d9ff",
  robotics: "#ff8a3d",
  people: "#ffcf5a",
};

export const groupLabel: Record<SkillGroup, string> = {
  compute: "Parallel compute",
  hardware: "Hardware",
  software: "Software",
  robotics: "Robotics & AI",
  people: "Innovation & leadership",
};
