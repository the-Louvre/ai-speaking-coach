import type { CoachState } from "../../shared/schemas";

const stateClass: Record<CoachState, string> = {
  idle: "idle",
  listening: "listening",
  thinking: "thinking",
  asking: "asking",
  reviewing: "reviewing",
  celebrating: "celebrating"
};

export function MascotAvatar({ state, size = 220 }: { state: CoachState; size?: number }) {
  const visualState = stateClass[state];

  return (
    <div
      className={`layered-coach-avatar layered-coach-${visualState}`}
      style={{ width: size, height: size }}
      aria-label={`虚拟教练状态：${state}`}
    >
      <svg viewBox="115 150 650 670" width={size} height={size} role="img" aria-hidden="true">
        <defs>
          <clipPath id="leftLensClip">
            <rect x="250" y="326" width="146" height="146" rx="44" />
          </clipPath>
          <clipPath id="rightLensClip">
            <rect x="424" y="326" width="146" height="146" rx="44" />
          </clipPath>
        </defs>

        <g className="state-aura" fill="none" stroke="#ffffff" strokeLinecap="round">
          <ellipse cx="410" cy="420" rx="302" ry="248" strokeWidth="5" opacity="0.34" />
          <ellipse cx="410" cy="420" rx="250" ry="206" strokeWidth="3" opacity="0.26" />
        </g>

        <g className="thinking-dots" fill="#ffffff">
          <circle cx="588" cy="298" r="10" />
          <circle cx="622" cy="276" r="14" />
          <circle cx="666" cy="292" r="18" />
        </g>

        <g className="celebration-rays" fill="none" stroke="#ffd84d" strokeLinecap="round">
          <path d="M246 246L224 212" strokeWidth="9" />
          <path d="M410 204V164" strokeWidth="9" />
          <path d="M588 244L616 212" strokeWidth="9" />
          <path d="M648 348L690 338" strokeWidth="9" />
          <circle cx="228" cy="330" r="8" fill="#ffd84d" stroke="none" />
        </g>

        <g className="coach-rig">
          <g className="layer hair-back">
            <path
              d="M175 584C155 585 141 574 148 555C154 540 154 529 143 511C118 469 117 421 139 377C151 352 176 334 187 307C209 252 246 212 305 199C351 190 398 203 431 232C467 202 521 194 566 211C617 230 645 270 659 326C667 359 691 370 707 397C732 439 733 487 710 527C696 552 706 567 688 583C663 604 590 581 530 575C464 568 413 579 375 579C333 579 272 569 218 582C201 586 187 584 175 584Z"
              fill="var(--coach-hair)"
            />
            <path
              d="M176 574C211 567 247 561 286 560C233 546 206 523 195 489C182 450 193 408 221 378C178 395 154 428 151 472C149 508 160 532 176 574Z"
              fill="var(--coach-hair-shadow)"
              opacity="0.46"
            />
            <path
              d="M596 570C648 574 684 585 694 569C666 552 653 528 666 492C679 455 670 421 644 392C684 408 707 443 709 486C712 525 688 556 664 574C645 573 623 571 596 570Z"
              fill="var(--coach-hair-shadow)"
              opacity="0.38"
            />
          </g>

          <g className="layer earrings">
            <path className="earring-left" d="M204 462C179 466 168 491 178 517C188 543 216 554 241 540" fill="none" stroke="var(--coach-gold)" strokeWidth="12" strokeLinecap="round" />
            <path className="earring-right" d="M615 462C641 465 653 489 644 516C635 543 607 556 581 542" fill="none" stroke="var(--coach-gold)" strokeWidth="12" strokeLinecap="round" />
          </g>

          <g className="layer neck-body">
            <path className="neck" d="M352 567H466V644C466 673 441 695 409 695C377 695 352 673 352 644V567Z" fill="var(--coach-body)" />
            <path className="torso" d="M346 619H470L530 820H286L346 619Z" fill="var(--coach-body)" />
            <path d="M365 728H452V820H365V728Z" fill="#494b4a" opacity="0.68" />
            <path d="M386 728H408V774H386V728ZM430 728H452V774H430V728Z" fill="#383a39" />
          </g>

          <g className="layer face">
            <path
              d="M244 338C244 300 273 272 311 272H351C365 272 375 283 381 297C389 281 404 270 425 270H448C491 270 515 300 515 343V349L587 369V515C587 551 558 580 522 580H295C258 580 229 551 229 515V371L244 367V338Z"
              fill="var(--coach-skin)"
            />
            <path
              d="M229 482V514C229 551 258 580 295 580H522C558 580 587 551 587 515V482C564 512 523 524 475 518C444 514 417 510 387 515C346 523 307 527 270 513C252 506 239 496 229 482Z"
              fill="var(--coach-skin-shadow)"
              opacity="0.18"
            />
            <path d="M244 360H402V427H244V360ZM423 373H581V431H423V373Z" fill="var(--coach-skin)" opacity="0.96" />
          </g>

          <g className="layer hair-front">
            <path
              d="M205 371C209 332 231 296 268 270C306 242 355 233 395 248C418 257 432 273 438 293C414 275 389 274 367 288C347 300 338 320 332 346C295 337 252 343 205 371Z"
              fill="var(--coach-hair)"
            />
            <path
              d="M431 292C450 262 494 242 546 252C591 260 625 291 639 334C654 381 632 410 598 426C597 391 586 360 563 335C537 306 493 295 431 292Z"
              fill="var(--coach-hair)"
            />
            <path d="M405 242C429 253 438 274 439 294C448 281 463 270 487 264C465 247 432 235 405 242Z" fill="#f5f7f7" opacity="0.72" />
          </g>

          <g className="layer eyes" clipPath="url(#leftLensClip)">
            <path d="M263 391C294 379 352 379 384 390V462H263V391Z" fill="#ffffff" />
            <ellipse className="eye-left" cx="327" cy="421" rx="22" ry="32" fill="var(--coach-eye)" />
            <rect className="eyelid-left" x="258" y="326" width="136" height="92" fill="var(--coach-skin)" />
          </g>

          <g className="layer eyes" clipPath="url(#rightLensClip)">
            <path d="M435 391C467 379 525 379 558 390V462H435V391Z" fill="#ffffff" />
            <ellipse className="eye-right" cx="496" cy="421" rx="22" ry="32" fill="var(--coach-eye)" />
            <rect className="eyelid-right" x="432" y="326" width="136" height="92" fill="var(--coach-skin)" />
          </g>

          <g className="layer glasses" fill="none" stroke="var(--coach-glasses)" strokeLinecap="round" strokeLinejoin="round">
            <rect x="250" y="326" width="146" height="146" rx="44" strokeWidth="11" />
            <rect x="424" y="326" width="146" height="146" rx="44" strokeWidth="11" />
            <path d="M396 399H424" strokeWidth="12" />
            <path d="M231 348H250" strokeWidth="15" />
            <circle cx="223" cy="348" r="7" fill="#bfc2c3" stroke="none" />
          </g>

          <g className="layer brows" fill="none" stroke="var(--coach-brow)" strokeLinecap="round" strokeLinejoin="round">
            <path className="brow-left" d="M284 380C307 372 343 372 366 380" strokeWidth="9" />
            <path className="brow-right" d="M454 380C477 372 513 372 536 380" strokeWidth="9" />
          </g>

          <g className="layer nose-mouth">
            <path className="nose" d="M405 446C413 458 418 468 417 476C416 486 408 491 400 489C393 487 390 480 393 472C396 462 401 454 405 446Z" fill="var(--coach-nose)" />
            <path className="mouth-smirk" d="M356 517C375 542 407 552 431 533" fill="none" stroke="var(--coach-brow)" strokeWidth="10" strokeLinecap="round" />
            <ellipse className="mouth-open" cx="399" cy="529" rx="22" ry="11" fill="var(--coach-brow)" />
            <path className="mouth-correct" d="M371 525C389 516 414 516 433 525" fill="none" stroke="var(--coach-brow)" strokeWidth="9" strokeLinecap="round" />
          </g>
        </g>

        <g className="speech-lines" fill="none" stroke="#ffffff" strokeLinecap="round">
          <path d="M672 420H728" strokeWidth="8" />
          <path d="M684 448H736" strokeWidth="7" />
          <path d="M674 476H716" strokeWidth="6" />
        </g>

        <g className="correction-mark" fill="none" stroke="#175cd3" strokeLinecap="round" strokeLinejoin="round">
          <path d="M664 422L681 439L721 398" strokeWidth="9" />
        </g>
      </svg>
    </div>
  );
}
