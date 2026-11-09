import BootVeil from "@/components/shell/BootVeil";
import Hero from "@/components/sections/Hero";
import About from "@/components/sections/About";
import Projects from "@/components/sections/Projects";
import Universe from "@/components/sections/Universe";
import Contact from "@/components/sections/Contact";
import Footer from "@/components/shell/Footer";

export default function Home() {
  return (
    <>
      <BootVeil />
      <Hero />
      <About />
      <Projects />
      <Universe />
      <Contact />
      <Footer />
    </>
  );
}
