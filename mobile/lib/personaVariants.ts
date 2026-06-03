// Per-persona appearance configs for the parametrized PersonaCharacter.
// Tuned for gender (eyelashes/lips vs stubble), personality and job (hair, accessory).
// Outfit follows each persona's accent so the character matches its card.

import type { PersonaVariant } from '@/components/speaking/PersonaCharacter'
import type { PersonaId } from './personas'

const F_LIP = '#D26B82' // rosier lip for female personas
const M_LIP = '#A8694F'

export const personaVariants: Record<PersonaId, PersonaVariant> = {
  // ─── IT / Startup ───
  // lukas is rendered by the bespoke LukasCharacter; kept here only as a fallback.
  lukas: { skin: '#F5C89A', skinShadow: '#D49060', hair: '#1A1A2E', outfit: '#2C3E50', outfitAccent: '#2D9CDB', eyeColor: '#1E2030', eyebrow: '#1A1A2E', lip: M_LIP, accessory: 'headset', accessoryColor: '#2D9CDB', hairStyle: 'short', gender: 'male' },
  emma: { skin: '#F7D3B0', skinShadow: '#DDA078', hair: '#E8743B', outfit: '#0A3832', outfitAccent: '#00BFA5', eyeColor: '#3B6B5E', eyebrow: '#C25A2A', lip: F_LIP, accessory: 'none', hairStyle: 'long', gender: 'female' },
  anna: { skin: '#F2C9A0', skinShadow: '#D49060', hair: '#7A4A2B', outfit: '#7A4D00', outfitAccent: '#F5A623', eyeColor: '#5C4033', eyebrow: '#5A3A22', lip: F_LIP, accessory: 'none', hairStyle: 'long', gender: 'female' },
  klaus: { skin: '#E8B58A', skinShadow: '#C9895C', hair: '#4A3226', outfit: '#F8F9FA', outfitAccent: '#991B1B', eyeColor: '#4A3226', eyebrow: '#3A2618', lip: M_LIP, accessory: 'hat', accessoryColor: '#FFFFFF', hairStyle: 'short', gender: 'male', facialHair: 'stubble' },
  // ─── Verkauf ───
  lena: { skin: '#F7D3B0', skinShadow: '#DDA078', hair: '#A66A30', outfit: '#065F46', outfitAccent: '#10B981', eyeColor: '#5C4033', eyebrow: '#7A4A22', lip: F_LIP, accessory: 'none', hairStyle: 'long', gender: 'female' },
  thomas: { skin: '#F5C89A', skinShadow: '#D49060', hair: '#5C4033', outfit: '#F8F9FA', outfitAccent: '#EAB308', eyeColor: '#5C4033', eyebrow: '#4A3226', lip: M_LIP, accessory: 'hat', accessoryColor: '#FFFFFF', hairStyle: 'side_part', gender: 'male', facialHair: 'stubble' },
  petra: { skin: '#F2C9A0', skinShadow: '#D49060', hair: '#3A2618', outfit: '#7F1D1D', outfitAccent: '#DC2626', eyeColor: '#3A2618', eyebrow: '#2A1A10', lip: F_LIP, accessory: 'none', hairStyle: 'short', gender: 'female' },
  // ─── Medizin ───
  sarah: { skin: '#F7D3B0', skinShadow: '#DDA078', hair: '#6B4226', outfit: '#4C1D95', outfitAccent: '#8B5CF6', eyeColor: '#5C4033', eyebrow: '#4A3226', lip: F_LIP, accessory: 'none', hairStyle: 'long', gender: 'female' },
  schneider: { skin: '#E8B58A', skinShadow: '#C9895C', hair: '#9A9A9A', outfit: '#E8EDF2', outfitAccent: '#3B82F6', eyeColor: '#3B5266', eyebrow: '#7A7A7A', lip: M_LIP, accessory: 'none', hairStyle: 'short', gender: 'male' },
  weber: { skin: '#F7D3B0', skinShadow: '#DDA078', hair: '#2A1A10', outfit: '#9D174D', outfitAccent: '#EC4899', eyeColor: '#3A2618', eyebrow: '#2A1A10', lip: F_LIP, accessory: 'none', hairStyle: 'long', gender: 'female' },
  // ─── Maschinenbau ───
  max: { skin: '#E8B58A', skinShadow: '#C9895C', hair: '#4A3226', outfit: '#854D0E', outfitAccent: '#EAB308', eyeColor: '#4A3226', eyebrow: '#3A2618', lip: M_LIP, accessory: 'none', hairStyle: 'short', gender: 'male', facialHair: 'stubble' },
  oliver: { skin: '#F2C9A0', skinShadow: '#D49060', hair: '#3A2618', outfit: '#3730A3', outfitAccent: '#6366F1', eyeColor: '#3A2618', eyebrow: '#2A1A10', lip: M_LIP, accessory: 'none', hairStyle: 'short', gender: 'male' },
  // ─── Service ───
  niklas: { skin: '#F2C9A0', skinShadow: '#D49060', hair: '#2A1A10', outfit: '#115E59', outfitAccent: '#14B8A6', eyeColor: '#3A2618', eyebrow: '#2A1A10', lip: M_LIP, accessory: 'none', hairStyle: 'short', gender: 'male' },
  nina: { skin: '#F7D3B0', skinShadow: '#DDA078', hair: '#1A1A1A', outfit: '#BE185D', outfitAccent: '#F472B6', eyeColor: '#2A1A10', eyebrow: '#1A1A1A', lip: F_LIP, accessory: 'none', hairStyle: 'long', gender: 'female' },
  // ─── Medien ───
  hannie: { skin: '#F7D3B0', skinShadow: '#DDA078', hair: '#E8743B', outfit: '#9A3412', outfitAccent: '#F97316', eyeColor: '#3B6B5E', eyebrow: '#C25A2A', lip: F_LIP, accessory: 'headset', accessoryColor: '#F97316', hairStyle: 'curly', gender: 'female' },
  // ─── Special — Vietnamese tutors ───
  tuan: { skin: '#E8B58A', skinShadow: '#C9895C', hair: '#1A1A1A', outfit: '#92400E', outfitAccent: '#F59E0B', eyeColor: '#1A1A1A', eyebrow: '#0A0A0A', lip: M_LIP, accessory: 'none', hairStyle: 'short', gender: 'male', facialHair: 'stubble' },
  lan: { skin: '#F2C9A0', skinShadow: '#D49060', hair: '#1A1A1A', outfit: '#5B21B6', outfitAccent: '#A78BFA', eyeColor: '#1A1A1A', eyebrow: '#0A0A0A', lip: F_LIP, accessory: 'none', hairStyle: 'long', gender: 'female' },
  minh: { skin: '#E8B58A', skinShadow: '#C9895C', hair: '#1A1A1A', outfit: '#991B1B', outfitAccent: '#EF4444', eyeColor: '#1A1A1A', eyebrow: '#0A0A0A', lip: M_LIP, accessory: 'none', hairStyle: 'curly', gender: 'male' },
}
