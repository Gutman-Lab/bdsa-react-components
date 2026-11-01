#!/usr/bin/env node
/**
 * Verifies that every file advertised by package.json#exports exists in a
 * non-empty form after a build.
 *
 * Usage: npm run build && npm run check:exports
 */

import { readFileSync, statSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const packageJsonPath = join(packageRoot, 'package.json')

/** @param {unknown} value @param {string[]} out */
function collectTargets(value, out) {
    if (typeof value === 'string') {
        if (value.startsWith('./')) out.push(value)
        return
    }

    if (Array.isArray(value)) {
        for (const entry of value) collectTargets(entry, out)
        return
    }

    if (value && typeof value === 'object') {
        for (const entry of Object.values(value)) collectTargets(entry, out)
    }
}

let pkg
try {
    pkg = JSON.parse(readFileSync(packageJsonPath, 'utf8'))
} catch (error) {
    console.error(`check:exports: unable to read package.json: ${error.message}`)
    process.exit(1)
}

if (!pkg.exports || typeof pkg.exports !== 'object') {
    console.error('check:exports: package.json has no "exports" map')
    process.exit(1)
}

const targets = []
collectTargets(pkg.exports, targets)

if (targets.length === 0) {
    console.error('check:exports: package.json#exports declares no file targets')
    process.exit(1)
}

const failures = []

for (const target of [...new Set(targets)].sort()) {
    // Subpath patterns (e.g. "./schemas/*") are resolved by the package
    // manager at import time; the expanded targets below verify the files.
    if (target.includes('*')) continue

    const absolute = join(packageRoot, target)

    let stat
    try {
        stat = statSync(absolute)
    } catch {
        failures.push(`${target} is missing (resolved to ${absolute})`)
        continue
    }

    if (!stat.isFile()) {
        failures.push(`${target} is not a file`)
        continue
    }

    if (stat.size === 0) {
        failures.push(`${target} is empty`)
    }
}

if (failures.length > 0) {
    console.error('check:exports: package exports are incomplete:')
    for (const failure of failures) console.error(`  - ${failure}`)
    process.exit(1)
}

console.log(`check:exports: ok (${targets.length} export target${targets.length === 1 ? '' : 's'} verified)`)
