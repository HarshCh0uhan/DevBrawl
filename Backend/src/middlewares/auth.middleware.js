import { verifyAccessToken } from '../services/token.service.js'
import { User } from '../models/user.model.js'
import { ApiError } from '../utils/apiError.js'

export const userAuth = async (req, res, next) => {
  try {
    const header = req.headers.authorization || ''
    const token = header.startsWith('Bearer ') ? header.slice(7) : null
    if (!token) throw new ApiError(401, 'Missing token')
    const decoded = verifyAccessToken(token)
    const user = await User.findById(decoded._id).select('-password')
    if (!user) throw new ApiError(401, 'User not found')
    req.user = user
    next()
  } catch (err) {
    next(err)
  }
}
