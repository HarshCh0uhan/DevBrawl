import { asyncHandler } from '../utils/asyncHandler.js'
import { validateRunCode } from '../validators/code.validators.js'
import { isRateLimited } from '../utils/rateLimiter.js'
import { executeCode } from '../utils/oneCompilerExecutor.js'
import { wrapCode } from './codeWrapper.js'

/**
 * Manual "Run Code" button handler — no test cases, just executes
 * whatever the user typed and returns raw stdout/stderr.
 */
export const executeBrawlCode = asyncHandler(async (req, res) => {
  // Validation failures use the same flat response contract as execution results.
  try {
    validateRunCode(req.body)
  } catch (err) {
    return res.status(400).json({
      success: false,
      status: 'Validation Error',
      output: err.message,
    })
  }

  const { sourceCode, languageId } = req.body
  const userId = req.user?._id?.toString() || req.ip

  if (isRateLimited(userId)) {
    return res.status(429).json({
      success: false,
      status: 'Rate Limited',
      output: 'Too many executions. Max 10 per minute.',
    })
  }

  // Network/API errors deliberately bubble to asyncHandler and the error middleware.
  const finalCode = wrapCode(sourceCode, languageId)
  const result = await executeCode(finalCode, languageId)

  if (result.compilationFailed) {
    return res.status(200).json({
      success: false,
      status: 'Compilation Error',
      output: result.stderr || 'Compilation failed',
    })
  }
  if (result.timedOut) {
    return res.status(200).json({
      success: false,
      status: 'Time Limit Exceeded',
      output: 'Your code exceeded the time limit.',
    })
  }
  if (result.code !== 0) {
    return res.status(200).json({
      success: false,
      status: 'Runtime Error',
      output: result.stderr || result.stdout || 'Runtime error occurred',
    })
  }

  return res.status(200).json({
    success: true,
    status: 'Accepted',
    output: result.stdout || '(no output)',
    stderr: result.stderr || null,
  })
})
