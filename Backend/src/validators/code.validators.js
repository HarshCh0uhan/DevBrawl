import { SUPPORTED_LANGUAGE_IDS } from '../constants/languages.js'
import { ApiError } from '../utils/apiError.js'

const MAX_SOURCE_BYTES = 100 * 1024

export const validateRunCode = ({ sourceCode, languageId } = {}) => {
  if (!sourceCode || typeof sourceCode !== 'string') {
    throw new ApiError(400, 'sourceCode is required')
  }
  if (!languageId && languageId !== 0) {
    throw new ApiError(400, 'languageId is required')
  }
  if (!SUPPORTED_LANGUAGE_IDS.includes(Number(languageId))) {
    throw new ApiError(
      400,
      `Unsupported languageId. Supported: ${SUPPORTED_LANGUAGE_IDS.join(', ')}`
    )
  }
  if (Buffer.byteLength(sourceCode, 'utf8') > MAX_SOURCE_BYTES) {
    throw new ApiError(400, 'Source code too large (max 100KB)')
  }
}
