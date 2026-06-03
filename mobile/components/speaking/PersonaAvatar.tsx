// Dispatcher: renders the bespoke 1:1 web character per persona. The four personas
// that use the parametrized IllustratedPersonaCharacter on web (thomas/sarah/hannie/
// minh) fall through to the parametrized PersonaCharacter — matching web exactly.

import type { PersonaId } from '@/lib/personas'
import { personaVariants } from '@/lib/personaVariants'
import { PersonaCharacter, type PersonaExpression } from './PersonaCharacter'
import { LukasCharacter, type CharExpression } from './characters/LukasCharacter'
import { EmmaCharacter } from './characters/EmmaCharacter'
import { AnnaCharacter } from './characters/AnnaCharacter'
import { KlausCharacter } from './characters/KlausCharacter'
import { LenaCharacter } from './characters/LenaCharacter'
import { PetraCharacter } from './characters/PetraCharacter'
import { SchneiderCharacter } from './characters/SchneiderCharacter'
import { WeberCharacter } from './characters/WeberCharacter'
import { MaxCharacter } from './characters/MaxCharacter'
import { OliverCharacter } from './characters/OliverCharacter'
import { NiklasCharacter } from './characters/NiklasCharacter'
import { NinaCharacter } from './characters/NinaCharacter'
import { TuanCharacter } from './characters/TuanCharacter'
import { LanCharacter } from './characters/LanCharacter'

interface PersonaAvatarProps {
  personaId: PersonaId
  expression?: string
  isTalking?: boolean
  paused?: boolean
}

export function PersonaAvatar({ personaId, expression = 'neutral', isTalking = false, paused = false }: PersonaAvatarProps) {
  switch (personaId) {
    case 'lukas':
      return <LukasCharacter expression={expression as CharExpression} isTalking={isTalking} paused={paused} />
    case 'emma':
      return <EmmaCharacter expression={expression} isTalking={isTalking} paused={paused} />
    case 'anna':
      return <AnnaCharacter expression={expression} isTalking={isTalking} paused={paused} />
    case 'klaus':
      return <KlausCharacter expression={expression} isTalking={isTalking} paused={paused} />
    case 'lena':
      return <LenaCharacter expression={expression} isTalking={isTalking} paused={paused} />
    case 'petra':
      return <PetraCharacter expression={expression} isTalking={isTalking} paused={paused} />
    case 'schneider':
      return <SchneiderCharacter expression={expression} isTalking={isTalking} paused={paused} />
    case 'weber':
      return <WeberCharacter expression={expression} isTalking={isTalking} paused={paused} />
    case 'max':
      return <MaxCharacter expression={expression} isTalking={isTalking} paused={paused} />
    case 'oliver':
      return <OliverCharacter expression={expression} isTalking={isTalking} paused={paused} />
    case 'niklas':
      return <NiklasCharacter expression={expression} isTalking={isTalking} paused={paused} />
    case 'nina':
      return <NinaCharacter expression={expression} isTalking={isTalking} paused={paused} />
    case 'tuan':
      return <TuanCharacter expression={expression} isTalking={isTalking} paused={paused} />
    case 'lan':
      return <LanCharacter expression={expression} isTalking={isTalking} paused={paused} />
    default:
      // thomas, sarah, hannie, minh — parametrized (web uses IllustratedPersonaCharacter)
      return <PersonaCharacter variant={personaVariants[personaId]} expression={expression as PersonaExpression} isTalking={isTalking} paused={paused} />
  }
}
