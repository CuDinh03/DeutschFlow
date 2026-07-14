// Vocabulary icon registry (Hạng mục A + B0). Maps each VocabIconKey to a
// concrete flat icon from Lucide (default) or Phosphor (farm animals, clothing,
// body, a few foods Lucide lacks). Both render as thin outline glyphs so they
// read as one set. Kept out of VocabGlyphTile so the component stays lean.
//
// Phosphor icons are DEEP-imported (`phosphor-react-native/src/icons/X`) — the
// package's own `exports` subpath — because Metro doesn't tree-shake its 1,512-
// icon barrel (`export * from`), so a root import would ship the whole set in
// the OTA bundle. Deep imports pull only the icons we use. (Package-exports
// resolution is default-on in Expo SDK 53+.)

import type { ComponentType } from 'react'
import type { LucideIcon } from 'lucide-react-native'
import {
  Apple, Cherry, Carrot, Banana, Egg, Fish, Beef, Pizza, Cake,
  Beer, Wine, Milk, Coffee, Soup, Droplet, Citrus, Salad,
  Dog, Cat, Bird, Rabbit,
  Car, Bus, Bike, TrainFront, Plane, Ship,
  House, DoorOpen, Bed, Armchair, Lamp, Table,
  Sun, Sunrise, Sunset, Moon, Cloud, CloudRain, Snowflake, Star, CloudSun,
  Flower2, TreePine, Trees, Leaf, Mountain, Waves,
  Book, Pencil, Backpack, School, GraduationCap, Scissors, Newspaper,
  Clock, Calendar, Smartphone, Laptop, Camera, Tv, Music,
  Key, Gift, Heart, Umbrella, Glasses, ShoppingBag, Shirt,
  Banknote, Coins, CreditCard,
  Baby, User, Users, Hand, Eye, Ear, Footprints,
  Stethoscope, Syringe, Pill, Hospital,
  Globe, Building2, Store, Church, Hotel, Briefcase, Shield, ChefHat,
} from 'lucide-react-native'
import type { IconProps } from 'phosphor-react-native'
import { BreadIcon } from 'phosphor-react-native/src/icons/Bread'
import { CheeseIcon } from 'phosphor-react-native/src/icons/Cheese'
import { HorseIcon } from 'phosphor-react-native/src/icons/Horse'
import { CowIcon } from 'phosphor-react-native/src/icons/Cow'
import { PantsIcon } from 'phosphor-react-native/src/icons/Pants'
import { DressIcon } from 'phosphor-react-native/src/icons/Dress'
import { HoodieIcon } from 'phosphor-react-native/src/icons/Hoodie'
import { SneakerIcon } from 'phosphor-react-native/src/icons/Sneaker'
import { BootIcon } from 'phosphor-react-native/src/icons/Boot'
import { BaseballCapIcon } from 'phosphor-react-native/src/icons/BaseballCap'
import { SockIcon } from 'phosphor-react-native/src/icons/Sock'
import { SmileyIcon } from 'phosphor-react-native/src/icons/Smiley'
import { ToothIcon } from 'phosphor-react-native/src/icons/Tooth'
import { ParkIcon } from 'phosphor-react-native/src/icons/Park'
import type { VocabIconKey } from '@/lib/vocabGlyph'

type PhosphorIcon = ComponentType<IconProps>
type IconEntry = { src: 'lucide'; Icon: LucideIcon } | { src: 'phosphor'; Icon: PhosphorIcon }

const L = (Icon: LucideIcon): IconEntry => ({ src: 'lucide', Icon })
const P = (Icon: PhosphorIcon): IconEntry => ({ src: 'phosphor', Icon })

const VOCAB_ICON: Record<VocabIconKey, IconEntry> = {
  // Food & drink
  apple: L(Apple), cherry: L(Cherry), carrot: L(Carrot), banana: L(Banana), egg: L(Egg),
  fish: L(Fish), meat: L(Beef), bread: P(BreadIcon), pizza: L(Pizza), cake: L(Cake),
  beer: L(Beer), wine: L(Wine), milk: L(Milk), coffee: L(Coffee), soup: L(Soup), water: L(Droplet),
  cheese: P(CheeseIcon), citrus: L(Citrus), salad: L(Salad),
  // Animals
  dog: L(Dog), cat: L(Cat), bird: L(Bird), rabbit: L(Rabbit), horse: P(HorseIcon), cow: P(CowIcon),
  // Transport
  car: L(Car), bus: L(Bus), bike: L(Bike), train: L(TrainFront), plane: L(Plane), ship: L(Ship),
  // Home
  house: L(House), door: L(DoorOpen), bed: L(Bed), chair: L(Armchair), lamp: L(Lamp), table: L(Table),
  // Sky & nature
  sun: L(Sun), sunrise: L(Sunrise), sunset: L(Sunset), moon: L(Moon), cloud: L(Cloud), rain: L(CloudRain),
  snow: L(Snowflake), star: L(Star), weather: L(CloudSun),
  flower: L(Flower2), tree: L(TreePine), forest: L(Trees), leaf: L(Leaf), mountain: L(Mountain), sea: L(Waves), park: P(ParkIcon),
  // Learning & objects
  book: L(Book), pencil: L(Pencil), backpack: L(Backpack), school: L(School), university: L(GraduationCap),
  scissors: L(Scissors), newspaper: L(Newspaper),
  clock: L(Clock), calendar: L(Calendar), phone: L(Smartphone), computer: L(Laptop), camera: L(Camera),
  tv: L(Tv), music: L(Music),
  key: L(Key), gift: L(Gift), heart: L(Heart), umbrella: L(Umbrella), glasses: L(Glasses), bag: L(ShoppingBag),
  // Clothing
  shirt: L(Shirt), pants: P(PantsIcon), dress: P(DressIcon), jacket: P(HoodieIcon), shoe: P(SneakerIcon),
  boot: P(BootIcon), hat: P(BaseballCapIcon), sock: P(SockIcon),
  // Money
  money: L(Banknote), coins: L(Coins), card: L(CreditCard),
  // People & body
  baby: L(Baby), person: L(User), people: L(Users), hand: L(Hand), eye: L(Eye), ear: L(Ear),
  face: P(SmileyIcon), tooth: P(ToothIcon), foot: L(Footprints),
  // Health
  doctor: L(Stethoscope), nurse: L(Syringe), pill: L(Pill), hospital: L(Hospital),
  // Places & jobs
  globe: L(Globe), building: L(Building2), store: L(Store), church: L(Church), hotel: L(Hotel),
  office: L(Briefcase), police: L(Shield), chef: L(ChefHat),
}

interface VocabIconProps {
  glyphKey: VocabIconKey
  size: number
  color: string
}

/** Renders the mapped icon, normalising the Lucide vs Phosphor prop APIs. */
export function VocabIcon({ glyphKey, size, color }: VocabIconProps) {
  const entry = VOCAB_ICON[glyphKey]
  if (entry.src === 'phosphor') {
    return <entry.Icon size={size} color={color} weight="regular" />
  }
  return <entry.Icon size={size} color={color} strokeWidth={2} />
}
