import validator from 'validator'
import { ApiError } from '../utils/apiError.js'

export const validateRegister = ({ username, email, password, fullName, phoneNumber } = {}) => {
  if (!username || !email || !password) {
    throw new ApiError(400, 'Fill All Entries')
  }
  if (typeof username !== 'string' || username.length < 3 || username.length > 30) {
    throw new ApiError(400, 'Username must be 3-30 characters')
  }
  if (typeof email !== 'string' || !validator.isEmail(email)) {
    throw new ApiError(400, 'Invalid Email')
  }
  if (typeof password !== 'string' || !validator.isStrongPassword(password, {
    minLength: 8,
    minLowercase: 1,
    minUppercase: 1,
    minNumbers: 1,
    minSymbols: 0,
  })) {
    throw new ApiError(400, 'Password is not Strong (min 8 chars, 1 upper, 1 lower, 1 number)')
  }
  if (
    typeof fullName !== 'string' ||
    !fullName.trim() ||
    typeof phoneNumber !== 'string' ||
    !phoneNumber.trim()
  ) {
    throw new ApiError(400, 'All common fields are required')
  }
}

export const validateLogin = ({ email, password } = {}) => {
  if (!email || !password) {
    throw new ApiError(400, 'Email and password are required')
  }
  if (typeof email !== 'string' || !validator.isEmail(email)) {
    throw new ApiError(400, 'Invalid Email')
  }
}
