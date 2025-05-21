// @ts-check

import { escapace, compose } from 'eslint-config-escapace'

export default compose(escapace(), {
  rules: {
    'depend/ban-dependencies': [
      'warn',
      {
        allowed: ['body-parser', 'execa', 'fs-extra', 'lodash-es'],
      },
    ],
  },
})
