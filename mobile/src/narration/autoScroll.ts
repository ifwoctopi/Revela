// Keeps the results list following the narration. A manual scroll pauses
// following until the user asks to resume. Honors reduced motion.

export class AutoScrollController {
  private readonly offsets = new Map<number, number>();
  private current = 0;
  private following = true;

  constructor(
    private readonly scrollTo: (y: number, animated: boolean) => void,
    private readonly reduceMotion: () => boolean,
    private readonly onFollowingChange: (following: boolean) => void,
  ) {}

  get isFollowing(): boolean {
    return this.following;
  }

  setSectionOffset(index: number, y: number): void {
    this.offsets.set(index, y);
  }

  /** Narration reached a new section. */
  onSectionStart(index: number): void {
    this.current = index;
    if (this.following) this.scrollToCurrent();
  }

  /** The user started dragging the list. */
  onUserScroll(): void {
    if (!this.following) return;
    this.following = false;
    this.onFollowingChange(false);
  }

  resumeFollowing(): void {
    this.following = true;
    this.onFollowingChange(true);
    this.scrollToCurrent();
  }

  private scrollToCurrent(): void {
    const y = this.offsets.get(this.current);
    if (y !== undefined) this.scrollTo(Math.max(0, y - 16), !this.reduceMotion());
  }
}
