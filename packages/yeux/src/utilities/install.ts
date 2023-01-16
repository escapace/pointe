import { safeReadPackageJson as readPackageJson } from '@pnpm/read-package-json'
import { execa } from 'execa'
import fse from 'fs-extra'
import { omitBy } from 'lodash-es'
import path from 'path'
import process from 'process'
import type { State } from '../types'
// import { buildEntries } from '../utilities/build-entries'
import { chmod, copyFile } from 'fs/promises'

const PACKAGE_JSON = async (state: State) => {
  const packageJson = await readPackageJson(state.packageJSONPath)

  if (packageJson === null) {
    throw new Error(`package.json: unable to read`)
  }

  return omitBy(
    {
      name: packageJson.name,
      version: packageJson.version,
      author: packageJson.author,
      license: packageJson.license,
      description: packageJson.description,
      dependencies: {
        // '@yeuxjs/runtime':
        //   state.command === 'preview'
        //     ? pathToFileURL(
        //         path.resolve(
        //           path.dirname(await resolve('@yeuxjs/runtime', state.basedir)),
        //           '../../'
        //         )
        //       )
        //     : '*',
        // 'source-map-support': state.sourceMapSupportVersion,
        ...(packageJson.dependencies ?? {})
      }
    },
    (value) => value === undefined
  )
}

export const install = async (state: State) => {
  const packageJSONPath = path.join(state.serverOutputDirectory, 'package.json')
  await fse.writeJSON(packageJSONPath, await PACKAGE_JSON(state), { spaces: 2 })

  const pnpmLockfile = path.join(state.directory, 'pnpm-lock.yaml')
  const npmLockfile = path.join(state.directory, 'package-lock.json')

  const packageManager = (await fse.pathExists(pnpmLockfile))
    ? 'pnpm'
    : (await fse.pathExists(npmLockfile))
    ? 'npm'
    : undefined

  if (packageManager === 'pnpm') {
    const destPnpmLockfile = path.join(
      state.serverOutputDirectory,
      'pnpm-lock.yaml'
    )

    await copyFile(pnpmLockfile, destPnpmLockfile)

    await execa(
      'pnpm',
      ['install', '--prod', '--prefer-offline', '--no-frozen-lockfile'],
      {
        stdout: process.stdout,
        stderr: process.stderr,
        cwd: state.serverOutputDirectory
      }
    )

    await chmod(pnpmLockfile, state.maskFile)
  }

  if (packageManager === 'npm') {
    const destNpmLockfile = path.join(
      state.serverOutputDirectory,
      'package-lock.json'
    )

    await copyFile(npmLockfile, destNpmLockfile)

    await execa('npm', ['install', '--production'], {
      stdout: process.stdout,
      stderr: process.stderr,
      cwd: state.serverOutputDirectory
    })

    await chmod(destNpmLockfile, state.maskFile)
  }
}
