# Side-view avatar walk references

Research date: 2026-09-18. Scope: reference research before another implementation attempt. No animation code changed by this research.

## Primary references and direct evidence

### Pedro Medeiros (Saint11): Walk Cycle

- [Author tutorial collection](https://saint11.org/blog/pixel-art-tutorials/), [author-maintained source repository](https://github.com/saint11/Saint11Tutorials), [original illustrated tutorial](https://raw.githubusercontent.com/saint11/Saint11Tutorials/master/Walk.gif).
- Inspected the actual tutorial image, including the illustrated sequence and labels, rather than relying on a search summary. The illustrated progression separates contact, down, lowest position, before-passing, passing, and up. The support leg visibly extends while the returning leg bends. The body rises again; it does not remain in the lowest pose.
- The author contrasts a 12-frame treatment with a 6-frame version useful at low resolution. Opposite arm and leg move together; the grounded leg travels toward the back relative to the body.
- This is a demonstration of readable poses, not a requirement that every game use six or twelve frames.

### Pedro Medeiros (Saint11): Top Down Walk Cycle

- [Original illustrated tutorial](https://raw.githubusercontent.com/saint11/Saint11Tutorials/master/TopDownWalkCycle.gif).
- Inspected the actual image. It starts from the idle pose, preserves depth ordering, and builds a basic six-frame cycle by advancing a leg while moving the same-side arm backward, then mirroring for the other leg.
- Additional intermediate frames are an optional smoothing step. Its sideways guidance applies the front animation logic and uses contrast on hands and feet to keep motion legible. The upward view reduces vertical torso/head movement.
- This is especially relevant because the user already approves the front/back movement and wants the side view to share that style and pacing.

### Animation Mentor / Jason Martinsen: Basic Human Walk Cycle

- [Authored workshop summary](https://www.animationmentor.com/blog/tutorial-animating-human-walk-cycle/).
- Direct article evidence: block contact, down, passing, and optionally up poses before smoothing. Down absorbs impact; up rises before the next contact. Foot translation stays linear to prevent sliding, followed by explicit knee-pop and foot-slide cleanup.
- This supports solving silhouettes and weight transfer before modifying interpolation or speed. Its typical 20–30 frames at 24 fps concerns that workshop's human walk; it is not a target timing for this stylized avatar.
- Read the article; did not watch its embedded long-form video.

### J. K. Riki: Walks Simplified

- [Author's illustrated article](https://www.animatorisland.com/secret-of-animation-walks-simplified/).
- Direct text evidence: establish four weight-transfer poses before arms and in-betweens. Contact uses the leading heel and trailing toe, then weight settles, pushes upward, and reaches the lift apex before the other step. The author prioritizes weight, balance, and overall feel.
- Read the article text; its illustrations were not retrieved in this pass. Treat the weight discussion as animation guidance, not a biomechanics measurement.

### Animation Mentor / Natasha Krinsky: Sneak Walk (limited access)

- [Authored workshop summary](https://www.animationmentor.com/blog/tutorial-animating-sneak-walk-cycle-with-personality/).
- Only an indexed excerpt was available reliably: the tutorial deliberately retains a bent knee while raising the hips slightly and uses tiptoe contact. Full-page retries timed out or were blocked; no claim of watching its video or inspecting the complete demonstration.
- This is supporting contrast only, not the main evidence for diagnosing our current pose.

## Application to this avatar: recommendations, not source facts

1. Match the approved front/back whole-body pose approach and existing cadence. Replacing the separate continuously articulated side rig is better aligned with that request than another isolated speed, knee, or foot-lift adjustment. Preserve front/back behavior.
2. Start from the approved idle silhouette and author the side contact and passing poses as complete bodies. Keep the pelvis tall enough that the support leg can read as extended; allow a brief small down pose rather than sustained knee compression. Exact pixel offsets must be judged against this sprite, not copied from a realistic rig.
3. Keep a visible alternating foot pickup and return, opposite arm swing, and readable hand/foot silhouettes. Avoid solving apparent dragging by lifting both knees higher: that can increase the crouched impression without fixing support.
4. Use the already-approved four-frame rhythm first. Neither primary pixel-art tutorial establishes that four frames are insufficient. More frames are justified only if the same pose style demonstrably needs them.
5. Compare both side directions against front/back at the same travel speed, on a floor with visible markers, at native size and enlarged. Check the contact/passing silhouettes and the loop boundary before subjective approval of the moving result.

The references establish a workflow and visual targets; they do not prove that a proposed implementation looks natural. The parent investigation supplies local code measurements and runtime review. This document intentionally contains no new numeric rig prescription or claim that the defect is fixed.

## User-supplied eight-frame guide (latest direction)

The user supplied `image.png`, “141 — Human Female Walk Cycle / Side View Dummy” (Slynyrd), showing 4/6/8-frame comparisons and eight sequential contact/down/passing/up poses. This supplied image is the direct motion target; no external video of it was reviewed. The user rejected the prior four-frame lateral interpretation and requested more intermediates and consistency with the approved vertical movement.

The revised approach uses eight complete side poses across the same cycle duration as the unchanged four-pose front/back views. This preserves step cadence while doubling pose sampling. Asset review rejected sheets with repeated contact poses, frozen arms, overlapping sprite gutters and mismatched body proportions. Subsequent revisions corrected pre-contact foot clearance, the second-half arm phase and compact character proportions before use. Eight distinct images and correct timing alone still do not establish subjective naturalness; compare the running preview to the supplied pose progression.
