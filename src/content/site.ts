export const site = {
  name: "Eyal Danino",
  shortName: "ED",
  title: "Eyal Danino — Computer Engineering, GPU Computing, Hardware & Robotics",
  description:
    "Computer Engineering student at the Technion working across GPU computing, computer architecture, FPGA design and robotics. Selected projects, military innovation work and the systems thinking behind them.",
  role: "Computer Engineering Student at the Technion | GPU Computing | Hardware & Software | Robotics",
  headline: ["EYAL", "DANINO"],
  tagline: "ENGINEERING WHAT'S NEXT.",
  subheadline: ["Computer Engineering @ Technion", "CUDA", "FPGA", "Robotics", "AI Systems"],
  links: {
    github: "https://github.com/danino18",
    linkedin: "https://www.linkedin.com/in/eyal-danino",
  },
  nav: [
    { id: "about", label: "About" },
    { id: "work", label: "Work" },
    { id: "universe", label: "Universe" },
    { id: "contact", label: "Contact" },
  ],
  /** Scroll pipeline stages; each maps to a page section. */
  stages: [
    { id: "top", label: "FETCH", caption: "Boot" },
    { id: "about", label: "DECODE", caption: "About" },
    { id: "work", label: "EXECUTE", caption: "Work" },
    { id: "universe", label: "MEMORY", caption: "Universe" },
    { id: "contact", label: "WRITEBACK", caption: "Contact" },
  ],
  about: {
    lead: "I'm a Computer Engineering student at the Technion who wants to understand computers all the way down.",
    paragraphs: [
      "I like following a single idea from the application, through the compiler and the runtime, past the memory hierarchy, into the logic gates that finally carry it out. The most interesting problems tend to sit on that boundary between software and silicon.",
      "In the army I served as an innovation officer in a technological unit, where I founded and commanded the Reef, the Israeli Navy's innovation accelerator, helping service members turn field needs into products.",
      "Right now that curiosity shows up as GPU kernels, a degree planner students actually use, an FPGA game written in SystemVerilog, a robot arm that has to see before it moves, and Wi-Fi sensing experiments I am still figuring out.",
    ],
    interests: [
      "GPU computing",
      "Computer architecture",
      "CUDA",
      "FPGA development",
      "Robotics",
      "Physical AI",
      "Low-level optimization",
      "Entrepreneurship",
      "Innovation leadership",
    ],
    /** Hardware-to-software metaphor, bottom (silicon) to top (product). */
    layers: [
      { id: "silicon", name: "Logic & silicon", note: "Gates, registers and finite-state machines. Where every abstraction finally becomes voltage.", tag: "SystemVerilog · FPGA" },
      { id: "arch", name: "Architecture", note: "Pipelines, caches and memory hierarchies. The contract between hardware and software.", tag: "Computer architecture" },
      { id: "parallel", name: "Parallel compute", note: "Thousands of threads, warps, coalesced access. Throughput as a design discipline.", tag: "CUDA · GPU architecture" },
      { id: "systems", name: "Systems software", note: "C/C++ and the runtime layers that decide how fast the hardware is allowed to be.", tag: "C/C++ · performance" },
      { id: "intel", name: "Perception & planning", note: "Robots and models that have to sense, decide and act in the physical world.", tag: "ROS 2 · Python · AI" },
      { id: "product", name: "Products", note: "Applications that real people use, built with the same rigor.", tag: "Product engineering" },
    ],
  },
  contact: {
    headline: "LET'S BUILD SOMETHING THAT MATTERS.",
    blurb: "The fastest way to reach me is through GitHub or LinkedIn.",
  },
} as const;

export const siteUrl = (() => {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (explicit) return explicit.replace(/\/$/, "");
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (vercel) return `https://${vercel}`;
  return "http://localhost:3000";
})();
