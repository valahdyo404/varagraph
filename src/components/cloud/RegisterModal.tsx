import { useState, type ComponentProps } from 'react'
import { X } from 'lucide-react'
import { useAuthStore } from '../../store/authStore'

type RegisterModalProps = {
  onClose: () => void
  onSwitchToLogin: () => void
}

type RegisterSubmitEvent = Parameters<NonNullable<ComponentProps<'form'>['onSubmit']>>[0]

export function RegisterModal({ onClose, onSwitchToLogin }: RegisterModalProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [validationError, setValidationError] = useState<string | null>(null)
  const register = useAuthStore((s) => s.register)
  const isLoading = useAuthStore((s) => s.isLoading)
  const error = useAuthStore((s) => s.error)

  const validateForm = (): boolean => {
    if (!email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
      setValidationError('Please enter a valid email address')
      return false
    }
    if (password.length < 8) {
      setValidationError('Password must be at least 8 characters')
      return false
    }
    if (password !== confirmPassword) {
      setValidationError('Passwords do not match')
      return false
    }
    setValidationError(null)
    return true
  }

  const handleSubmit = async (e: RegisterSubmitEvent) => {
    e.preventDefault()
    if (!validateForm()) return
    const success = await register(email, password)
    if (success) {
      onClose()
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-sm rounded-xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-[#EEF0F4] px-6 py-4">
          <h2 className="text-lg font-semibold text-[#0F172A]">Create account</h2>
          <button type="button" onClick={onClose} className="text-[#94A3B8] hover:text-[#6336F1]">
            <X size={20} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6">
          {(validationError || error) && (
            <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-xs font-medium text-red-700">
              {validationError || error}
            </div>
          )}
          <div className="mb-4">
            <label className="mb-1.5 block text-xs font-semibold text-[#334155]" htmlFor="reg-email">
              Email
            </label>
            <input
              id="reg-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="h-10 w-full rounded-md border border-[#E5E7EB] px-3 text-sm text-[#0F172A] outline-none focus:border-[#8B5CF6]"
              placeholder="you@example.com"
            />
          </div>
          <div className="mb-4">
            <label className="mb-1.5 block text-xs font-semibold text-[#334155]" htmlFor="reg-password">
              Password
            </label>
            <input
              id="reg-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="h-10 w-full rounded-md border border-[#E5E7EB] px-3 text-sm text-[#0F172A] outline-none focus:border-[#8B5CF6]"
              placeholder="At least 8 characters"
            />
          </div>
          <div className="mb-6">
            <label className="mb-1.5 block text-xs font-semibold text-[#334155]" htmlFor="reg-confirm">
              Confirm Password
            </label>
            <input
              id="reg-confirm"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              className="h-10 w-full rounded-md border border-[#E5E7EB] px-3 text-sm text-[#0F172A] outline-none focus:border-[#8B5CF6]"
              placeholder="Confirm your password"
            />
          </div>
          <button
            type="submit"
            disabled={isLoading}
            className="h-11 w-full rounded-md bg-[#6336F1] text-sm font-semibold text-white hover:bg-[#5930DE] disabled:cursor-wait disabled:opacity-60"
          >
            {isLoading ? 'Creating account...' : 'Create account'}
          </button>
          <p className="mt-4 text-center text-xs text-[#64748B]">
            Already have an account?{' '}
            <button type="button" onClick={onSwitchToLogin} className="font-semibold text-[#6336F1] hover:underline">
              Sign in
            </button>
          </p>
        </form>
      </div>
    </div>
  )
}