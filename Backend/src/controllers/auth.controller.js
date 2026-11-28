import { User } from '../models/user.model.js'
import { ApiError } from '../utils/apiError.js'
import { ApiResponse } from '../utils/apiResponse.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import {
  signAccessToken,
  createRefreshToken,
  rotateRefreshToken,
  revokeRefreshToken,
} from '../services/token.service.js'
import {
  refreshCookieOptions,
  refreshCookieBase,
} from '../config/cookie.js'
import { validateLogin } from '../validators/auth.validators.js'
import bcrypt from 'bcryptjs'

export const login = asyncHandler(async (req, res) => {
  validateLogin(req.body)
  const { email, password } = req.body
  const user = await User.findOne({ email }).select('+password')
  if (!user) throw new ApiError(401, 'Invalid credentials')
  const ok = await bcrypt.compare(password, user.password)
  if (!ok) throw new ApiError(401, 'Invalid credentials')

  const accessToken = signAccessToken(user)
  const { raw } = await createRefreshToken(user._id, {
    deviceInfo: req.headers['user-agent'] || '',
    ip: req.ip,
  })

  res.cookie('refreshToken', raw, refreshCookieOptions)
  res.status(200).json(new ApiResponse(200, {
    user: {
      _id: user._id,
      username: user.username,
      email: user.email,
      avatar: user.avatar || null,
      brawlPoints: user.brawlPoints || 0,
      ownedItems: user.ownedItems || [],
      activeAvatar: user.activeAvatar || 'default',
    },
    accessToken,
  }, 'Logged in'))
})

export const refresh = asyncHandler(async (req, res) => {
  const raw = req.cookies?.refreshToken
  if (!raw) throw new ApiError(401, 'No refresh token')

  let rotated
  try {
    rotated = await rotateRefreshToken(raw, {
      deviceInfo: req.headers['user-agent'] || '',
      ip: req.ip,
    })
  } catch (err) {
    res.clearCookie('refreshToken', refreshCookieBase)
    throw err
  }

  const user = await User.findById(rotated.record.userId)
  if (!user) throw new ApiError(401, 'User not found')
  const accessToken = signAccessToken(user)
  res.cookie('refreshToken', rotated.raw, refreshCookieOptions)
  res.status(200).json(new ApiResponse(200, { accessToken }, 'Refreshed'))
})

export const logout = asyncHandler(async (req, res) => {
  const raw = req.cookies?.refreshToken
  if (raw) {
    try {
      await revokeRefreshToken(raw, 'logout')
    } catch {}
  }
  res.clearCookie('refreshToken', refreshCookieBase)
  res.status(204).end()
})

export const me = asyncHandler(async (req, res) => {
  res.status(200).json(new ApiResponse(200, {
    user: {
      _id: req.user._id,
      username: req.user.username,
      email: req.user.email,
      avatar: req.user.avatar || null,
      brawlPoints: req.user.brawlPoints || 0,
      ownedItems: req.user.ownedItems || [],
      activeAvatar: req.user.activeAvatar || 'default',
    },
  }, 'OK'))
})
