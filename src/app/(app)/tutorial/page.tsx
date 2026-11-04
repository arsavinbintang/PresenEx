import Link from "next/link";
import { requireSession } from "@/lib/auth/session";
import { PageHeader } from "@/components/ui/page-header";
import { Icon } from "@/components/ui/icons";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import {
  getTutorial,
  TUTORIAL_ROLE_LABEL,
  type TutorialBab,
} from "@/lib/tutorial";

export const dynamic = "force-dynamic";

function Blok({ blok }: { blok: TutorialBab["blok"][number] }) {
  return (
    <section className="card p-4">
      <h3 className="mb-2 text-sm font-bold">{blok.judul}</h3>

      {blok.langkah ? (
        <ol className="space-y-2">
          {blok.langkah.map((langkah, index) => (
            <li key={langkah} className="flex gap-2.5 text-sm leading-relaxed">
              <span
                className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[0.7rem] font-bold"
                style={{ background: "var(--accent)", color: "#fff" }}
              >
                {index + 1}
              </span>
              <span>{langkah}</span>
            </li>
          ))}
        </ol>
      ) : null}

      {blok.poin ? (
        <ul className="space-y-1.5">
          {blok.poin.map((poin) => (
            <li
              key={poin}
              className="flex gap-2 text-sm leading-relaxed"
            >
              <span
                className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full"
                style={{ background: "var(--accent)" }}
              />
              <span>{poin}</span>
            </li>
          ))}
        </ul>
      ) : null}

      {blok.catatan ? (
        <p
          className="mt-3 rounded-lg px-3 py-2 text-xs leading-relaxed"
          style={{
            background: "var(--sakit-soft)",
            color: "var(--sakit)",
          }}
        >
          {blok.catatan}
        </p>
      ) : null}
    </section>
  );
}

export default async function TutorialPage({
  searchParams,
}: {
  searchParams: Promise<{ bab?: string }>;
}) {
  const params = await searchParams;
  const session = await requireSession();
  const role = session.profile.role;

  const bab = getTutorial(role);
  const aktif =
    bab.find((item) => item.id === params.bab) ?? bab[0] ?? null;
  const index = aktif ? bab.indexOf(aktif) : -1;
  const sebelumnya = index > 0 ? bab[index - 1] : null;
  const sesudahnya = index >= 0 && index < bab.length - 1 ? bab[index + 1] : null;

  return (
    <div>
      <PageHeader
        title={TUTORIAL_ROLE_LABEL[role] ?? "Tutorial"}
        description={`Panduan lengkap untuk ${role === "admin" ? "admin sekolah" : "PIC ekskul"} — dari dasar sampai fitur lanjutan.`}
        action={<ThemeToggle className="btn btn-ghost btn-sm" />}
      />

      <nav
        aria-label="Daftar bab tutorial"
        className="-mx-1 mb-4 flex gap-1.5 overflow-x-auto pb-1"
      >
        {bab.map((item) => {
          const aktifItem = item.id === aktif?.id;
          return (
            <Link
              key={item.id}
              href={`/tutorial?bab=${item.id}`}
              className="flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors"
              style={
                aktifItem
                  ? {
                      background: "var(--accent)",
                      borderColor: "var(--accent)",
                      color: "#fff",
                    }
                  : { color: "var(--muted)" }
              }
            >
              <Icon name={item.ikon} className="h-3.5 w-3.5" />
              {item.judul}
            </Link>
          );
        })}
      </nav>

      {aktif ? (
        <div className="space-y-3">
          <div className="flex items-start gap-3">
            <span
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
              style={{ background: "var(--accent-soft)", color: "var(--accent)" }}
            >
              <Icon name={aktif.ikon} className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-lg font-bold tracking-tight">
                {aktif.judul}
              </h2>
              <p className="muted text-sm">{aktif.ringkasan}</p>
            </div>
          </div>

          {aktif.blok.map((blok) => (
            <Blok key={blok.judul} blok={blok} />
          ))}

          <div className="flex items-center justify-between gap-2 pt-1">
            {sebelumnya ? (
              <Link
                href={`/tutorial?bab=${sebelumnya.id}`}
                className="btn btn-ghost btn-sm"
              >
                <Icon name="back" className="h-4 w-4" />
                {sebelumnya.judul}
              </Link>
            ) : (
              <span />
            )}
            {sesudahnya ? (
              <Link
                href={`/tutorial?bab=${sesudahnya.id}`}
                className="btn btn-primary btn-sm"
              >
                {sesudahnya.judul}
                <Icon name="chevron" className="h-4 w-4" />
              </Link>
            ) : (
              <span className="muted text-xs">Bab terakhir ✓</span>
            )}
          </div>
        </div>
      ) : (
        <p className="muted text-sm">Konten tutorial belum tersedia.</p>
      )}
    </div>
  );
}
