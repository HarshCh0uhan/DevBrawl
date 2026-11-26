import validator from 'validator'
import { ApiError } from '../utils/apiError.js'

export const validateLogin = ({ email, password } = {}) => {
  if (!email || !password) {
    throw new ApiError(400, 'Email and password are required')
  }
  if (!validator.isEmail(email)) throw new ApiError(400, 'Invalid email')
}

export const validateRegister = ({ username, email, password } = {}) => {
  if (!username || !email || !password) {
    throw new ApiError(400, 'All fields required')
  }
  if (!validator.isEmail(email)) throw new ApiError(400, 'Invalid email')
}
