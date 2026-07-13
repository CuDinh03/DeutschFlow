// Leading glyph tile for a vocabulary word (Hạng mục A). Renders a flat Lucide
// icon in the Galerie tile language when the word maps to a concrete object;
// renders nothing (null) for abstract/unknown words so the caller's layout
// falls back cleanly — no grey placeholder. Icon + tint come from `vocabGlyph`.

import { View, type StyleProp, type ViewStyle } from 'react-native'
import type { LucideIcon } from 'lucide-react-native'
import {
  Apple, Cherry, Carrot, Banana, Egg, Fish, Beef, Croissant, Pizza, Cake,
  Beer, Wine, Milk, Coffee, Soup, Droplet,
  Dog, Cat, Bird, Rabbit,
  Car, Bus, Bike, TrainFront, Plane, Ship,
  House, DoorOpen, Bed, Armchair, Lamp,
  Sun, Moon, Cloud, CloudRain, Snowflake, Star, Flower2, TreePine, Trees, Leaf, Mountain, Waves,
  Book, Pencil, Backpack, School, GraduationCap, Scissors, Newspaper,
  Clock, Calendar, Smartphone, Laptop, Camera, Tv, Music,
  Key, Gift, Heart, Umbrella, Glasses, Shirt, ShoppingBag,
  Banknote, Coins, CreditCard,
  Baby, User, Users, Hand, Eye,
  Stethoscope, Pill, Hospital,
  Globe, Building2, Store, Church, Hotel,
} from 'lucide-react-native'
import { radius, useTheme } from '@/lib/theme'
import { topicGlyphColors } from '@/lib/topicGlyph'
import { resolveVocabGlyph, type VocabIconKey } from '@/lib/vocabGlyph'

const VOCAB_ICON: Record<VocabIconKey, LucideIcon> = {
  apple: Apple, cherry: Cherry, carrot: Carrot, banana: Banana, egg: Egg, fish: Fish,
  meat: Beef, bread: Croissant, pizza: Pizza, cake: Cake, beer: Beer, wine: Wine,
  milk: Milk, coffee: Coffee, soup: Soup, water: Droplet,
  dog: Dog, cat: Cat, bird: Bird, rabbit: Rabbit,
  car: Car, bus: Bus, bike: Bike, train: TrainFront, plane: Plane, ship: Ship,
  house: House, door: DoorOpen, bed: Bed, chair: Armchair, lamp: Lamp,
  sun: Sun, moon: Moon, cloud: Cloud, rain: CloudRain, snow: Snowflake, star: Star,
  flower: Flower2, tree: TreePine, forest: Trees, leaf: Leaf, mountain: Mountain, sea: Waves,
  book: Book, pencil: Pencil, backpack: Backpack, school: School, university: GraduationCap,
  scissors: Scissors, newspaper: Newspaper,
  clock: Clock, calendar: Calendar, phone: Smartphone, computer: Laptop, camera: Camera,
  tv: Tv, music: Music,
  key: Key, gift: Gift, heart: Heart, umbrella: Umbrella, glasses: Glasses, shirt: Shirt, bag: ShoppingBag,
  money: Banknote, coins: Coins, card: CreditCard,
  baby: Baby, person: User, people: Users, hand: Hand, eye: Eye,
  doctor: Stethoscope, pill: Pill, hospital: Hospital,
  globe: Globe, building: Building2, store: Store, church: Church, hotel: Hotel,
}

interface VocabGlyphTileProps {
  german: string
  meaning?: string | null
  /** Square edge in px (icon scales to ~52%). */
  size?: number
  style?: StyleProp<ViewStyle>
}

/** Returns `null` (renders nothing) when the word has no concrete icon. */
export function VocabGlyphTile({ german, meaning, size = 40, style }: VocabGlyphTileProps) {
  const c = useTheme().colors
  const glyph = resolveVocabGlyph(german, meaning)
  if (!glyph) return null

  const { tileBg, iconColor } = topicGlyphColors(c, glyph.tint)
  const Glyph = VOCAB_ICON[glyph.key]

  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        {
          width: size,
          height: size,
          borderRadius: radius.sm,
          backgroundColor: tileBg,
          alignItems: 'center',
          justifyContent: 'center',
        },
        style,
      ]}
    >
      <Glyph size={Math.round(size * 0.52)} color={iconColor} strokeWidth={2} />
    </View>
  )
}
