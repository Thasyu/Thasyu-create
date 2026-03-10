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
    <div className="flex min-h-screen flex-col bg-black text-zinc-100">
      <nav className="mx-auto flex w-full max-w-[1200px] items-center px-6 py-6 md:px-10 lg:px-12">
        <div className="nav-item flex items-center gap-3">
          <div className="grid h-9 w-9 place-content-center rounded-xl border border-blue-400/50 bg-blue-500/20 text-xs font-black text-blue-200 shadow-lg shadow-blue-950/50">CT</div>
          <p className="text-lg font-black tracking-tight">Thasyu create</p>
        </div>
      </nav>

      <main className="mx-auto flex w-full max-w-[1200px] flex-1 items-center justify-center px-6 py-10 md:px-10 md:py-14 lg:px-12">
        <section className="w-full max-w-[980px] space-y-10 text-center md:space-y-12">
          <h1 className="space-y-3 text-[clamp(2.8rem,8.4vw,7rem)] font-black leading-[1.05] tracking-tight">
            <span className="hero-title-line block">退屈な文字を、</span>
            <span className="hero-title-line block text-blue-400">主役レベルに躍らせる。</span>
          </h1>

          <p className="hero-subtitle mx-auto max-w-3xl text-lg leading-relaxed text-zinc-300 md:text-2xl">
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

      <footer className="mx-auto w-full max-w-[1200px] px-6 pb-8 text-center text-sm text-zinc-500 md:px-10 lg:px-12">
        Thasyu create - Text Animation Studio
      </footer>
    </div>
  );
}