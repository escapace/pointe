import fse from 'fs-extra'
import path from 'path'
import process from 'process'
import semver from 'semver'
import arg from 'arg'
import { execa } from 'execa'

const error = (message) => {
  console.error(message)

  process.exit(1)
}

// Options:
//       --access <public|restricted>  Tells the registry whether this package should
//                                     be published as public or restricted
//       --dry-run                     Does everything a publish would do except
//                                     actually publishing to the registry
//       --force                       Packages are proceeded to be published even if
//                                     their current version is already in the
//                                     registry. This is useful when a
//                                     "prepublishOnly" script bumps the version of
//                                     the package before it is published
//       --ignore-scripts              Ignores any publish related lifecycle scripts
//                                     (prepublishOnly, postpublish, and the like)
//       --no-git-checks               Don't check if current branch is your publish
//                                     branch, clean, and up-to-date
//       --otp                         When publishing packages that require
//                                     two-factor authentication, this option can
//                                     specify a one-time password
//       --publish-branch              Sets branch name to publish. Default is master
//       --report-summary              Save the list of the newly published packages
//                                     to "pnpm-publish-summary.json". Useful when
//                                     some other tooling is used to report the list
//                                     of published packages.
//       --tag <tag>                   Registers the published package with the given
//                                     tag. By default, the "latest" tag is used.

async function main() {
  const args = arg({
    '--dry-run': Boolean
  })

  let version = args._[0]

  if (!version) {
    error('No version specified')
  }

  if (!semver.valid(version)) {
    error(`Incorrect version "${version}"`)
  }

  version = semver.clean(version)

  const { name, version: currentVersion } = await fse.readJson(
    path.join(process.cwd(), 'package.json')
  )

  if (currentVersion === version) {
    error(
      `Package version from "${version}" matches the current version "${currentVersion}"`
    )
  }

  await execa(
    'pnpm',
    [
      'publish',
      '--access',
      'public',
      '--publish-branch',
      'trunk',
      args['--dry-run'] ? '--dry-run' : undefined
    ].filter((value) => value !== undefined)
  )

  // console.log(name, version)
}

main()
