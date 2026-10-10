import { execFileSync } from 'node:child_process'

export default function globalSetup() {
  execFileSync('node', ['e2e/make-fixtures.mjs'], { stdio: 'inherit' })
}
