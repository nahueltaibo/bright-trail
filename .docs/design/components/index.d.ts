import type * as React from 'react';

export type IconName = 'speaker' | 'flag' | 'home' | 'lock' | 'back' | 'next' | 'check' | 'backspace' | 'pause' | 'play' | 'plus' | 'share' | 'chevron' | 'sprout' | 'refresh' | 'question' | 'half' | 'gap' | 'star' | 'moon' | 'book' | 'close' | 'alert' | 'tree' | 'list' | 'bookmark' | 'hand';
export type Animal = 'fox' | 'owl' | 'penguin' | 'frog' | 'lion' | 'unicorn' | 'octopus' | 'dinosaur' | 'panda' | 'cheetah';
export type SkillState = 'unknown' | 'assumed' | 'gap' | 'learning' | 'mastered' | 'review';

export interface IconProps { name: IconName; size?: string; stroke?: number; className?: string }
export interface KidButtonProps { icon?: IconName; label: string; variant?: 'primary' | 'plain'; size?: 'xl'; showLabel?: boolean; disabled?: boolean; onClick?: () => void }
export interface IconButtonProps { icon: IconName; label: string; variant?: 'kid' | 'quiet' | 'parent'; pressed?: boolean; onClick?: () => void }
export interface FlagButtonProps { flagged?: boolean; onFlag?: () => void }
export interface ButtonProps { children?: React.ReactNode; icon?: IconName; variant?: 'primary' | 'secondary' | 'secondary-danger' | 'danger' | 'link'; small?: boolean; full?: boolean; disabled?: boolean; onClick?: () => void }
export interface AvatarProps { animal: Animal; size?: string; label?: string; decorative?: boolean }
export interface AvatarTileProps { animal: Animal; name: string; size?: string; onClick?: () => void }
export interface AvatarPickerProps { value?: Animal; label?: string; wide?: boolean; onChange?: (a: Animal) => void }
export interface EmojiVisualProps { kind?: 'single' | 'row' | 'tenframe' | 'slot'; emoji?: string; count?: number; frames?: number; label?: string; caption?: string }
export interface ChoiceTileProps { label: React.ReactNode; state?: 'idle' | 'right' | 'missed' | 'rest'; ariaLabel?: string; onClick?: () => void }
export interface KeypadProps { value?: string; decimal?: boolean; result?: 'hit' | 'miss'; layout?: 'stack' | 'side'; hideKeys?: boolean; maxLength?: number; after?: React.ReactNode; onChange?: (v: string) => void; onSubmit?: (v: string) => void }
export interface NumberLineProps { min?: number; max?: number; step?: number; value?: number; answer?: number; revealed?: boolean; label?: string; onChange?: (v: number) => void; onSubmit?: (v: number) => void }
export interface FeedbackPanelProps { result: 'hit' | 'miss'; why?: string; onNext?: () => void }
export interface StoryCardProps { narration: string; text?: string; visual?: React.ReactNode; readingMode?: boolean }
export interface ProgressDotsProps { total: number; current: number; variant?: 'dots' | 'steps'; noun?: string }
export interface TrailStop { title?: string; state: 'mastered' | 'review' | 'next' | 'ahead' | 'locked'; onClick?: () => void }
export interface TrailMapProps { stops: TrailStop[]; avatar?: Animal; orientation?: 'vertical' | 'horizontal'; rowHeight?: number; height?: number; label?: string }
export interface StateBadgeProps { state: SkillState; compact?: boolean }
export interface SkillGraphProps { nodes: { id: string; title: string; state: SkillState; x: number; y: number }[]; edges: [string, string][]; columns?: { x: number; label: string }[]; width?: number; height?: number; nodeWidth?: number }
export interface ParentFrameProps { title?: string; back?: string | false; onBack?: () => void; wide?: boolean; children?: React.ReactNode }
export interface SectionProps { title?: string; description?: string; action?: React.ReactNode; padded?: boolean; plain?: boolean; children?: React.ReactNode }
export interface ParentRowProps { title: string; meta?: string; leading?: React.ReactNode; trailing?: React.ReactNode; chevron?: boolean; action?: boolean; onClick?: () => void }
export interface TextFieldProps { label: string; value?: string; placeholder?: string; hint?: string; error?: string | null; type?: string; inputMode?: string; onChange?: (e: unknown) => void }
export interface ChipGroupProps { label?: string; options: (string | { value: string; label: string })[]; value?: string; hint?: string; onChange?: (v: string) => void }
export interface ToggleProps { label: string; hint?: string; checked?: boolean; onChange?: (on: boolean) => void }
export interface PinPadProps { mode?: 'create' | 'confirm' | 'enter'; length?: number; value?: string; error?: string; onComplete?: (pin: string) => void }
export interface ConfirmButtonProps { label: string; question?: string; consequence: string; confirmLabel?: string; cancelLabel?: string; tone?: 'danger'; icon?: IconName; open?: boolean; onConfirm?: () => void }
export interface EmptyStateProps { title: string; body?: string; icon?: IconName; art?: React.ReactNode; action?: React.ReactNode }
export interface LoadingProps { zone?: 'kid' | 'parent'; label?: string; rows?: number }
export interface DeviceProps { kind?: 'phone' | 'phone-land' | 'tablet'; label?: string; zone?: 'kid' | 'parent'; dyslexic?: boolean; scroll?: 'end' | number; children?: React.ReactNode }

export declare function Icon(p: IconProps): React.ReactElement;
export declare function KidButton(p: KidButtonProps): React.ReactElement;
export declare function IconButton(p: IconButtonProps): React.ReactElement;
export declare function FlagButton(p: FlagButtonProps): React.ReactElement;
export declare function Button(p: ButtonProps): React.ReactElement;
export declare function Avatar(p: AvatarProps): React.ReactElement;
export declare function AvatarTile(p: AvatarTileProps): React.ReactElement;
export declare function AvatarPicker(p: AvatarPickerProps): React.ReactElement;
export declare function EmojiVisual(p: EmojiVisualProps): React.ReactElement;
export declare function ChoiceTile(p: ChoiceTileProps): React.ReactElement;
export declare function Keypad(p: KeypadProps): React.ReactElement;
export declare function NumberLine(p: NumberLineProps): React.ReactElement;
export declare function FeedbackPanel(p: FeedbackPanelProps): React.ReactElement;
export declare function StoryCard(p: StoryCardProps): React.ReactElement;
export declare function ProgressDots(p: ProgressDotsProps): React.ReactElement;
export declare function TrailMap(p: TrailMapProps): React.ReactElement;
export declare function StateBadge(p: StateBadgeProps): React.ReactElement;
export declare function SkillGraph(p: SkillGraphProps): React.ReactElement;
export declare function ParentFrame(p: ParentFrameProps): React.ReactElement;
export declare function Section(p: SectionProps): React.ReactElement;
export declare function ParentRow(p: ParentRowProps): React.ReactElement;
export declare function TextField(p: TextFieldProps): React.ReactElement;
export declare function ChipGroup(p: ChipGroupProps): React.ReactElement;
export declare function Toggle(p: ToggleProps): React.ReactElement;
export declare function PinPad(p: PinPadProps): React.ReactElement;
export declare function ConfirmButton(p: ConfirmButtonProps): React.ReactElement;
export declare function EmptyState(p: EmptyStateProps): React.ReactElement;
export declare function Loading(p: LoadingProps): React.ReactElement;
export declare function Device(p: DeviceProps): React.ReactElement;
