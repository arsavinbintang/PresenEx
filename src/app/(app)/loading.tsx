/**
 * Kerangka tampilan selama halaman sedang dimuat. Membuat navigasi terasa
 * instan karena pengguna langsung melihat struktur halaman.
 */
export default function Loading() {
  return (
    <div className="animate-pulse" aria-busy="true" aria-label="Memuat">
      <div className="mb-5 space-y-2">
        <div className="h-6 w-40 rounded-md bg-[var(--surface-2)]" />
        <div className="h-3.5 w-64 max-w-full rounded-md bg-[var(--surface-2)]" />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {Array.from({ length: 6 }).map((_, index) => (
          <div
            key={index}
            className="card h-24 bg-[var(--surface-2)]"
          />
        ))}
      </div>
    </div>
  );
}
