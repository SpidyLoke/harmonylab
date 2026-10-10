// Export everything to a JSON file, or restore from one.

import { useState } from 'react'
import { downloadJson, exportAll, importAll, ImportError } from '../../db/exportImport'
import { localDay } from '../../db/repo'
import { useProfile } from '../../state/profile'
import { useSettings } from '../../state/settings'
import { Button } from './Button'

export function BackupPanel() {
  const [includeAudio, setIncludeAudio] = useState(true)
  const [message, setMessage] = useState<{ text: string; good: boolean } | null>(null)
  const loadProfile = useProfile((s) => s.load)
  const loadSettings = useSettings((s) => s.load)

  const doExport = async () => {
    const data = await exportAll(includeAudio)
    downloadJson(data, `harmonylab-backup-${localDay()}.json`)
    setMessage({ text: 'Backup saved to your downloads.', good: true })
  }

  const doImport = async (file: File) => {
    if (!confirm('Restoring replaces everything on this device with the backup. Carry on?')) return
    try {
      const r = await importAll(JSON.parse(await file.text()))
      await Promise.all([loadProfile(), loadSettings()])
      setMessage({ text: `Restored: ${r.songs} songs and ${r.attempts} takes.`, good: true })
    } catch (e) {
      setMessage({ text: e instanceof ImportError ? e.message : "Couldn't read that file.", good: false })
    }
  }

  return (
    <section className="mt-6 rounded-3xl border border-line bg-surface p-5">
      <h2 className="font-semibold">Your data</h2>
      <p className="mt-1 text-sm text-muted">
        Everything is stored on this device only. Export a backup file to keep it safe or move to another phone or
        computer, then import it there.
      </p>
      <label className="mt-3 flex min-h-11 items-center gap-3 text-sm">
        <input type="checkbox" checked={includeAudio} onChange={(e) => setIncludeAudio(e.target.checked)} className="h-5 w-5 accent-[var(--color-spot)]" />
        Include backing-track audio (bigger file)
      </label>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button variant="primary" onClick={() => void doExport()}>
          Export backup
        </Button>
        <label className="inline-flex min-h-12 cursor-pointer items-center rounded-2xl border border-line bg-surface-2 px-5 font-semibold">
          Import backup
          <input type="file" accept="application/json,.json" className="sr-only" onChange={(e) => e.target.files?.[0] && void doImport(e.target.files[0])} />
        </label>
      </div>
      {message && (
        <p className={`mt-3 text-sm ${message.good ? 'text-good' : 'text-bad'}`} role="status">
          {message.good ? '✓ ' : '✕ '}
          {message.text}
        </p>
      )}
    </section>
  )
}
