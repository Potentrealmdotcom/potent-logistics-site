import { createClient } from './sbclient.js'

const SUPABASE_URL  = import.meta.env.VITE_SUPABASE_URL  || ''
const SUPABASE_KEY  = import.meta.env.VITE_SUPABASE_ANON_KEY || ''

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { storageKey: 'ccml-auth' } })

// All CCML tables live in POTENT's Supabase project under the ccml_ prefix (see RUN-THIS-SQL-CCML.sql).
// A user can read/write only their own rows. The plan and mail credits can only be changed by the server after a verified payment.

export const signUp = (email, password, fullName) =>
  supabase.auth.signUp({ email, password, options: { data: { full_name: fullName } } })
export const signIn = (email, password) => supabase.auth.signInWithPassword({ email, password })
export const signOut = () => supabase.auth.signOut()
export const getSession = () => supabase.auth.getSession()
export const onAuthChange = (cb) => supabase.auth.onAuthStateChange(cb)

export const getProfile = async (userId) => {
  const { data, error } = await supabase.from('ccml_profiles').select('*').eq('id', userId).single()
  if (error) { console.error('getProfile:', error.message); return null }
  return data
}

export const getProgress = async (userId) => {
  const { data, error } = await supabase.from('ccml_progress').select('lesson_id').eq('user_id', userId)
  if (error) { console.error('getProgress:', error.message); return [] }
  return data.map(r => r.lesson_id)
}
export const markLessonComplete = async (userId, lessonId) => {
  const { error } = await supabase.from('ccml_progress')
    .upsert({ user_id: userId, lesson_id: lessonId, completed_at: new Date().toISOString() }, { onConflict: 'user_id,lesson_id' })
  if (error) console.error('markLessonComplete:', error.message)
}
export const unmarkLessonComplete = async (userId, lessonId) => {
  const { error } = await supabase.from('ccml_progress').delete().eq('user_id', userId).eq('lesson_id', lessonId)
  if (error) console.error('unmarkLessonComplete:', error.message)
}

export const getChecklist = async (userId) => {
  const { data, error } = await supabase.from('ccml_checklist').select('item_id').eq('user_id', userId)
  if (error) { console.error('getChecklist:', error.message); return [] }
  return data.map(r => r.item_id)
}
export const toggleChecklistItem = async (userId, itemId, checked) => {
  if (checked) {
    const { error } = await supabase.from('ccml_checklist').upsert({ user_id: userId, item_id: itemId }, { onConflict: 'user_id,item_id' })
    if (error) console.error('checkItem:', error.message)
  } else {
    const { error } = await supabase.from('ccml_checklist').delete().eq('user_id', userId).eq('item_id', itemId)
    if (error) console.error('uncheckItem:', error.message)
  }
}

export const getDisputes = async (userId) => {
  const { data, error } = await supabase.from('ccml_disputes').select('*').eq('user_id', userId).order('created_at', { ascending: false })
  if (error) { console.error('getDisputes:', error.message); return [] }
  return data
}
export const addDispute = async (userId, dispute) => {
  const { data, error } = await supabase.from('ccml_disputes').insert({ user_id: userId, ...dispute }).select().single()
  if (error) { console.error('addDispute:', error.message); return null }
  return data
}
export const updateDispute = async (id, updates) => {
  const { error } = await supabase.from('ccml_disputes').update({ ...updates, updated_at: new Date().toISOString() }).eq('id', id)
  if (error) console.error('updateDispute:', error.message)
}
export const deleteDispute = async (id) => {
  const { error } = await supabase.from('ccml_disputes').delete().eq('id', id)
  if (error) console.error('deleteDispute:', error.message)
}

export const getVendors = async (userId) => {
  const { data, error } = await supabase.from('ccml_vendors').select('*').eq('user_id', userId)
  if (error) { console.error('getVendors:', error.message); return [] }
  return data
}
export const upsertVendor = async (userId, vendorName, updates) => {
  const { error } = await supabase.from('ccml_vendors')
    .upsert({ user_id: userId, vendor_name: vendorName, ...updates, updated_at: new Date().toISOString() }, { onConflict: 'user_id,vendor_name' })
  if (error) console.error('upsertVendor:', error.message)
}

// Done-For-You intake. Only the intake fields can be written here; status, funding and notes belong to the office.
export const submitDFYIntake = async (userId, formData) => {
  const allowed = ['full_name','email','phone','address','dob','llc_name','llc_state','llc_date','ein','current_score','bankruptcy_last2','negative_items','total_negative','goal_amount','timeline','funding_use','trademark_filed','trademark_name','agree_disclosure','agree_fee']
  const row = { user_id: userId, updated_at: new Date().toISOString() }
  allowed.forEach(k => { if (formData && formData[k] !== undefined) row[k] = formData[k] })
  const { error } = await supabase.from('ccml_dfy_clients').upsert(row, { onConflict: 'user_id' })
  if (error) { console.error('submitDFYIntake:', error.message); return false }
  return true
}
export const getDFYClient = async (userId) => {
  const { data, error } = await supabase.from('ccml_dfy_clients').select('*').eq('user_id', userId).single()
  if (error) return null
  return data
}

// Certified mail requests (created by the server function, readable by the owner of the request)
export const getMailRequests = async (userId) => {
  const { data, error } = await supabase.from('ccml_mail_requests').select('id,to_name,status,tracking_number,created_at').eq('user_id', userId).order('created_at', { ascending: false })
  if (error) { console.error('getMailRequests:', error.message); return [] }
  return data
}
