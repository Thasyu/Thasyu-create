"use client";
import { useEffect } from "react";
import gsap from "gsap";

export default function Home() {
  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap
        .timeline({ defaults: { ease: "power3.out" } })
        .from(".nav-item", {
          y: -20,
          opacity: 0,
          duration: 0.6,
          stagger: 0.08,
        })
        .from(
          ".hero-title-line",
          {
            y: 60,
            opacity: 0,
            duration: 0.8,
            stagger: 0.15,
          },
          "-=0.1",
        )
        .from(
          ".hero-subtitle, .hero-cta",
          {
            y: 24,
            opacity: 0,
            duration: 0.6,
            stagger: 0.12,
          },
          "-=0.35",
        );
    });

    return () => ctx.revert();
  }, []);

  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-black text-zinc-100">
      <div className="pointer-events-none absolute inset-0 z-0">
        <div className="animated-bg-wave absolute inset-[-35%] opacity-90" />
        <div className="animated-orb orb-one absolute -left-40 top-[-14%] h-[42rem] w-[42rem] rounded-full bg-blue-500/35 blur-[130px]" />
        <div className="animated-orb-reverse orb-two absolute -right-36 top-[10%] h-[36rem] w-[36rem] rounded-full bg-cyan-400/25 blur-[130px]" />
        <div className="animated-orb orb-three absolute bottom-[-30%] left-[16%] h-[44rem] w-[44rem] rounded-full bg-indigo-500/30 blur-[140px]" />
      </div>

      <nav className="relative z-10 mx-auto flex w-full max-w-[1200px] items-center px-6 py-6 md:px-10 lg:px-12">
        <div className="nav-item flex items-center gap-3">
          <div className="grid h-9 w-9 place-content-center rounded-xl border border-blue-400/50 bg-blue-500/20 text-xs font-black text-blue-200 shadow-lg shadow-blue-950/50">CT</div>
          <p className="text-lg font-black tracking-tight">Thasyu create</p>
        </div>
      </nav>

      <main className="relative z-10 mx-auto flex w-full max-w-[1200px] flex-1 items-center justify-center px-6 py-10 md:px-10 md:py-14 lg:px-12 lg:py-16">
        <section className="w-full max-w-[980px] space-y-10 text-center md:space-y-12 lg:max-w-[1080px]">
          <h1 className="space-y-3 text-[clamp(2.8rem,8.4vw,7rem)] font-black leading-[1.05] tracking-tight lg:text-[7.25rem] lg:leading-[1.02]">
            <span className="hero-title-line block">退屈な文字を、</span>
            <span className="hero-title-line block text-blue-400 lg:whitespace-nowrap">主役レベルに躍らせる。</span>
          </h1>

          <p className="hero-subtitle mx-auto max-w-3xl text-lg leading-relaxed text-zinc-300 md:text-2xl lg:whitespace-nowrap">
            Thasyu create は、文字アニメーションをすばやく作れるプロジェクトです。
          </p>

          <div className="hero-cta flex flex-wrap justify-center gap-4">
            <button className="rounded-2xl bg-blue-600 px-9 py-4 text-lg font-bold text-white transition hover:-translate-y-0.5 hover:bg-blue-500 hover:shadow-lg hover:shadow-blue-950/50">
              プロジェクトを始める
            </button>
            <button className="rounded-2xl border border-blue-700/70 bg-zinc-900 px-9 py-4 text-lg font-semibold text-zinc-200 transition hover:border-blue-500">
              ドキュメントを見る
            </button>
          </div>
        </section>
      </main>

      <footer className="relative z-10 mx-auto w-full max-w-[1200px] px-6 pb-8 text-center text-sm text-zinc-500 md:px-10 lg:px-12">
        Thasyu create - Text Animation Studio
      </footer>
    </div>
  );
}