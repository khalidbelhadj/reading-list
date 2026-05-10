---
name: flashcards
description: Use whenever the user asks to create, write, generate, propose, or improve spaced repetition flashcards from source material such as papers, textbooks, articles, or lecture notes. Trigger this skill even when the user phrases it casually ("make some Anki cards from this", "turn this paper into flashcards", "review the cards I just wrote") or works with a Reading List, Mochi, or Anki workflow. Apply this skill before generating any Q&A pair intended for spaced repetition, so the cards follow proven principles for atomicity, bidirectionality, and concept-graph coverage rather than naive prose-to-Q&A conversion.
---

# Effective Flashcards

This skill captures the principles and patterns for writing flashcards that actually stick in long-term memory. It is drawn primarily from Fernando Borretti's *Effective Spaced Repetition* and Piotr Woźniak's *Twenty rules of formulating knowledge*. Apply it whenever generating or refining flashcards.

The principles are listed in rough order of importance. **Atomicity is the load-bearing rule.** Most failure modes reduce to violating it.

## Principles

### 1. Atomicity is paramount

One fact per card. If the answer enumerates more than one item, split the card. The only exception is a "test card" that asks the user to recite a list whose items each already have their own atomic card.

The reason: large cards are harder to remember and impossible to grade honestly. If the answer has four facts and you recall three, neither "remembered" nor "forgot" is right. The card is broken.

### 2. Write bidirectional cards

For every term ↔ definition, notation ↔ meaning, and child ↔ parent pair, generate both directions. Skip a direction only when the answer is trivially obvious from the question (e.g. "what is a microglia a kind of?" is silly because the name gives it away).

### 3. Separate the list from its members

When a concept has named sub-parts, write one card asking for the list, and a separate card for each item's definition. Never combine them. This is the single most common failure mode in naive flashcard generation.

### 4. Ask the same concept multiple ways

Formal and informal definitions. Forward and backward. Notation and intuition. Cross-links to neighbouring concepts. Redundancy strengthens recall: memory is frequency times volume, and the deck as a whole can be as repetitive as needed even though individual cards stay tiny.

### 5. Cache derived insights

If the source implies something it doesn't explicitly say, and you can verify the inference is correct, write a card for it. Don't force the future reviewer to re-derive the same fact every time.

### 6. Understand before memorising

Don't generate cards for material the source hasn't actually explained. If the source is unclear, ambiguous, or seems to skip steps, flag this back to the user rather than fabricate cards that paper over the gap.

## Patterns

These are templates for common information shapes. Recognise the shape, apply the template.

### Definition pattern
- `What is X?` → `[definition]`
- `What is the term for [definition]?` → `X`

### Notation pattern
- `What does [symbol] denote?` → `[concept]`
- `What is the notation for [concept]?` → `[symbol]`

### Hierarchy pattern
For a parent with children A, B, C:
- `What are the kinds of [parent]?` → `A, B, C`
- For each child: `What is A?` → `[definition]`, plus the backward `What is the term for [definition of A]?` → `A`
- For each child (when not obvious from the name): `A is a kind of...` → `[parent]`

### Multiple-equivalent-definitions pattern
When one concept has N equivalent definitions:
- For each definition: a forward card (`What is X in terms of [angle]?` → `[definition]`)
- For each definition: a backward card (`What is the term for [definition]?` → `X`). Multiple backward cards will share the same answer. That's intentional, the redundancy reinforces equivalence.

### Cached-insight pattern
1. State the source fact as a card.
2. Identify implications the source doesn't explicitly state.
3. Verify each implication.
4. Write a card for each verified implication, in both directions where meaningful.
5. If multiple implications combine into a higher-level relationship (e.g. inverse proportionality), write a card for that relationship too, often as a fill-in-the-blank.

## Anti-patterns

Watch for these when generating cards. Each is a signal to split, rewrite, or remove.

- **Multi-fact answers.** If the answer contains "and" connecting two distinct facts, split.
- **Long prose answers.** If the answer doesn't fit comfortably in one breath, the card is too big.
- **Combined list and definitions.** "What are the types of X?" with each type's definition stuffed into the answer. Always split.
- **One direction when both are useful.** Every term/definition card needs a backward partner unless the reverse is trivial.
- **Cards that test multiple things.** "What is X and how does it work?" is two cards.
- **Vague answers** that admit multiple correct phrasings. Tighten the question or the answer.
- **Cards for things you don't understand yet.** Build the concept graph first, then generate cards.

## Style and formatting

Cards render as markdown. Apply these conventions to every generated card:

- **Bold** key terms in answers.
- Use bullet lists for enumerations.
- Use code spans for math and code: `$2^{10}$`, `\d`, `K_d`.
- Avoid em dashes in card content. Use periods, colons, or restructure into bullets instead.
- Keep answers concise. If you're tempted to write a paragraph, the card is wrong.
- Use headers in answers only when the answer has structured parts, which is usually a sign the card is too big.

## Workflow

When generating flashcards from source material, work through these steps:

1. **Read and understand the source.** Identify concepts, relationships, and any inferences worth caching. If anything is unclear, ask the user before proceeding.
2. **Sketch the concept graph** mentally or on paper. What are the nodes? What are the edges that questions will traverse?
3. **Classify each chunk** by pattern: definition, notation, hierarchy, sequence, multiple-equivalent-definition, or cached-insight.
4. **Generate cards by pattern**, applying the templates above. Be aggressive about atomicity.
5. **Review for anti-patterns.** Check every card against the anti-pattern list. Split or rewrite as needed.
6. **Add bidirectional partners.** For each forward card, decide whether the backward direction is non-trivial. Add it if so.
7. **Add cached insights.** Walk through derived facts and add cards for them.
8. **Present for user review** before saving. Show the proposed cards grouped logically (by concept or pattern), so the user can correct or trim before persisting.

---

## Worked examples

These examples demonstrate the principles on concrete material. Each follows the same structure: source text, thought process, resulting cards.

### Example 1: atomicity wrong vs right (neuron types)

**Source**

Neurons can be divided into three functional categories: sensory neurons, which feed information into the brain; motor neurons, which send commands to muscles; and interneurons, which connect within the central nervous system. Interneurons themselves split into local interneurons, which form circuits with nearby cells, and relay interneurons, which have long axons spanning brain regions.

**Thought process**

The naive approach stuffs each category and its definition into one card:

| Question | Answer |
| --- | --- |
| What are the functional categories of neuron? | Sensory: feed sensory information into the brain. Motor: send commands to muscles. Interneurons: connect within the CNS. |

This violates atomicity. The answer is three definitions glued together. If the user recalls sensory and motor but blanks on interneurons, neither grade is correct.

The fix is to separate the list of names from each individual definition, then add backward cards.

**Cards**

List card:

| Question | Answer |
| --- | --- |
| What are the functional categories of neuron? | **Sensory**, **motor**, **interneurons**. |

Definitions, forward:

| Question | Answer |
| --- | --- |
| What are sensory neurons? | Neurons that feed information into the brain. |
| What are motor neurons? | Neurons that send commands to the muscles. |
| What are interneurons? | Neurons that connect within the CNS. |
| What are the types of interneuron? | **Local**, **relay**. |
| What are local interneurons? | Interneurons that form circuits with nearby neurons. |
| What are relay interneurons? | Interneurons with long axons that communicate across brain regions. |

Definitions, backward:

| Question | Answer |
| --- | --- |
| What is the term for a neuron that feeds information into the brain? | **Sensory neuron**. |
| What is the term for a neuron that sends commands to the muscles? | **Motor neuron**. |
| What is the term for a neuron that connects within the CNS? | **Interneuron**. |
| What is the term for an interneuron that forms circuits with nearby neurons? | **Local interneuron**. |
| What is the term for an interneuron that communicates across brain regions? | **Relay interneuron**. |

### Example 2: hierarchy with multiple axes (magma formation)

**Source**

Magma is liquid rock beneath the Earth's surface. Three processes can form it. Increasing temperature melts rock directly. Decreasing pressure liquefies rock by freeing atoms to move. Adding water lowers the melting point, because water molecules disrupt the crystal bonds. Magma forms in three places. At hot spots, hot rock rises and pressure-release melting occurs. In rift zones, separating plates allow hot rock to rise into the gap and again undergo pressure-release melting. In subduction zones, water-bearing crust sinks into the mantle, water rises into overlying rock, and the addition of water causes melting.

**Thought process**

Three things to memorise: what magma is, the processes that form it, and the places where it forms. Each gets its own list-of-members treatment. The cross-axis "which process happens where" is worth its own bidirectional pair, because it links two of the three concepts together.

**Cards**

Definition, bidirectional:

| Question | Answer |
| --- | --- |
| What is magma? | Liquid rock under the Earth's surface. |
| What is the term for liquid rock under the surface of the Earth? | **Magma**. |

Processes — list, then per-process explanation. Skip the obvious "why does increasing temperature melt rock":

| Question | Answer |
| --- | --- |
| What are the magma-forming processes? | **Increasing temperature**, **decreasing pressure**, **addition of water**. |
| Why does decreasing pressure melt rock? | Atoms become more free to move. |
| Why does adding water lower the melting point of rock? | Water molecules disrupt the bonds in the rock minerals. |

Places — list, then process-per-place and place-per-process in both directions:

| Question | Answer |
| --- | --- |
| Where does magma form? | **Hot spots**, **rift zones**, **subduction zones**. |
| What magma-forming process happens at a hot spot? | Pressure-release melting. |
| What magma-forming process happens in a rift zone? | Pressure-release melting. |
| What magma-forming process happens in a subduction zone? | Increasing temperature and addition of water. |
| Where does magma form by pressure release? | Hot spots and rift zones. |
| Where does magma form by increasing temperature and the addition of water? | Subduction zones. |

Full causal explanation per place:

| Question | Answer |
| --- | --- |
| How does magma form at a hot spot? | Hot mantle rock rises; the decrease in pressure causes it to melt. |
| How does magma form in a rift zone? | Plates move apart, hot rock rises to fill the gap, and the decrease in pressure causes it to melt. |
| How does magma form in a subduction zone? | Waterlogged crust sinks into the mantle; water rises into overlying rock; the addition of water causes it to melt. |

### Example 3: multiple equivalent definitions (voltage)

**Source**

Voltage between two points A and B can be defined two equivalent ways. Either as the difference in electric potential between the two points, or as the work done by a 1C particle as it travels from A to B.

**Thought process**

One concept, two definitions. Each definition gets a forward card (concept → definition) and a backward card (definition → concept). The two backward cards both have the same answer ("voltage"), and that's deliberate. The redundancy reinforces that both definitions point to the same thing.

**Cards**

| Question | Answer |
| --- | --- |
| What is voltage in terms of electric potential? | The difference in electric potential between two points. |
| What is voltage in terms of work? | The work done by a 1C particle as it travels from A to B. |
| What is the term for the difference in electric potential between two points? | **Voltage**. |
| What is the term for the work done by a 1C particle as it travels between two points? | **Voltage**. |

### Example 4: cached insights (dissociation constant)

**Source**

The **dissociation constant** (`$K_d$`) of a drug is the drug concentration at which half the binding sites in an assay are occupied.

**Thought process**

The source states one fact, but several others follow by reasoning:

- A high `$K_d$` implies low binding affinity, because more drug is needed to reach half-occupancy.
- A low `$K_d$` implies high binding affinity, because less drug is needed.
- Therefore `$K_d$` is inversely proportional to binding affinity.

These derived facts deserve their own cards. Don't make future-you re-derive them every review session.

**Cards**

Stated fact and notation:

| Question | Answer |
| --- | --- |
| What is the term for the drug concentration where half the binding sites are occupied? | **Dissociation constant**. |
| What is the notation for the dissociation constant? | `$K_d$` |
| What does `$K_d$` stand for? | The dissociation constant. |

Cached implications, forward:

| Question | Answer |
| --- | --- |
| What does a low value of `$K_d$` mean? | **High** binding affinity. |
| Why does a low value of `$K_d$` imply high binding affinity? | Fewer molecules are needed to reach the same occupancy. |
| What does a high value of `$K_d$` mean? | **Low** binding affinity. |
| Why does a high value of `$K_d$` imply low binding affinity? | More molecules are needed to reach the same occupancy. |

Cached implications, backward:

| Question | Answer |
| --- | --- |
| If a drug's binding affinity is high, what does that tell us about `$K_d$`? | `$K_d$` is **low**. |
| If a drug's binding affinity is low, what does that tell us about `$K_d$`? | `$K_d$` is **high**. |

The relationship itself, two phrasings:

| Question | Answer |
| --- | --- |
| Describe the relationship between `$K_d$` and binding affinity. | `$K_d$` is **inversely proportional** to binding affinity. |
| `$K_d$` is ___ proportional to binding affinity. | **Inversely**. |

### Example 5: layered list-of-members (vector spaces)

**Source**

Informally, a vector space is a set whose elements (called vectors) can be added or scaled. Formally, a vector space over a field `$\mathbb{F}$` is a set `$V$` together with two operations, vector addition with signature `$V \times V \to V$` and scalar multiplication with signature `$V \times \mathbb{F} \to V$`, satisfying six axioms: commutativity of addition, associativity of addition, identity of addition, inverse of addition, identity of scaling, and distributivity.

**Thought process**

Multiple layers of decomposition apply here:

1. The concept itself has both an informal and a formal definition. Both worth capturing.
2. The two operations have signatures, worth memorising separately.
3. The six axioms form a list, but each axiom also has a formal statement. Apply list-vs-members at this level too: one card for the list of axiom names, one card per axiom for its statement. Backward cards from formula to name are optional but cheap.

**Cards**

Definition layer:

| Question | Answer |
| --- | --- |
| Informally, what is a vector space? | A set whose elements can be added or scaled. |
| Formally, what is a vector space? | A set `$V$` over a field `$\mathbb{F}$` with two operations (vector addition and scalar multiplication) satisfying six axioms. |
| What are the elements of a vector space called? | **Vectors**. |
| What is the term for a set whose elements can be added or scaled? | **Vector space**. |

Operations layer:

| Question | Answer |
| --- | --- |
| What is the signature of vector addition? | `$V \times V \to V$` |
| What is the signature of scalar multiplication? | `$V \times \mathbb{F} \to V$` |

Axioms — list, then per-axiom statements:

| Question | Answer |
| --- | --- |
| What are the axioms that define a vector space? | **Commutativity of addition**, **associativity of addition**, **identity of addition**, **inverse of addition**, **identity of scaling**, **distributivity**. |
| State the axiom: commutativity of addition (vector spaces) | `$u + v = v + u$` |
| State the axiom: associativity of addition (vector spaces) | `$u + (v + w) = (u + v) + w$` |
| State the axiom: identity of addition (vector spaces) | `$\exists 0 \in V : v + 0 = v$` |
| State the axiom: inverse of addition (vector spaces) | `$\forall v \in V, \exists -v \in V : v + (-v) = 0$` |
| State the axiom: identity of scaling (vector spaces) | `$1v = v$` |
| State the axiom: distributivity (vector spaces) | `$\forall v \in V, a, b \in \mathbb{F} : (a + b)v = av + bv$` |

Optional backward (formula → name):

| Question | Answer |
| --- | --- |
| Name this axiom: `$u + v = v + u$` | **Commutativity of addition**. |
| Name this axiom: `$1v = v$` | **Identity of scaling**. |
| Name this axiom: `$\forall v \in V, \exists -v \in V : v + (-v) = 0$` | **Inverse of addition**. |

### Example 6: ML paper (Barlow Twins)

This example applies the principles to a typical ML paper section, where several patterns appear at once.

**Source**

Barlow Twins is a self-supervised learning method that avoids representational collapse without using contrastive negatives, predictors, stop-gradient operations, or momentum encoders. Two distorted views of each image are passed through twin networks (sharing weights) to produce two batches of embeddings. Each embedding feature is z-score normalised along the batch dimension, after which the cross-correlation matrix `$C$` is computed between the two views' embeddings. The loss has two terms: an **invariance term** that pushes diagonal entries of `$C$` toward 1, and a **redundancy reduction term** (weighted by `$\lambda$`) that pushes off-diagonal entries toward 0. The diagonal target encourages each embedding component to be invariant under augmentation; the off-diagonal target decorrelates components so each carries non-redundant information. The name nods to H. Barlow's 1961 hypothesis that sensory systems should recode redundant inputs into a factorial code.

**Thought process**

Several patterns appear at once:

1. **Definition** of the method itself (forward and backward).
2. **Contrast with prior SSL methods** ("what it doesn't need") — worth one card because it's the headline framing of the paper.
3. **Notation** for `$C$` and how it's normalised.
4. **List-of-members** for the two loss terms, then per-term cards for what each does, in both directions.
5. **Cached insight**: the collapse-prevention argument follows from the construction of the loss but isn't always stated as a single card. Worth lifting out.
6. **Etymology** (the H. Barlow reference) — usually low priority, but for memorable papers a one-card etymology helps anchor recall.

A common failure here is to write one giant card titled "What is Barlow Twins?" with five paragraphs. Split aggressively along the structure above.

**Cards**

Method definition, bidirectional:

| Question | Answer |
| --- | --- |
| What is **Barlow Twins**? | A self-supervised learning method that prevents collapse by pushing the cross-correlation matrix of two augmented views toward the identity. |
| What is the term for the SSL method that prevents collapse by pushing the cross-correlation matrix of two augmented views toward the identity? | **Barlow Twins**. |

Contrast with other SSL methods:

| Question | Answer |
| --- | --- |
| What does Barlow Twins **not** need that other SSL methods rely on? | Negative samples, predictors, stop-gradient, momentum encoders. |

Cross-correlation matrix:

| Question | Answer |
| --- | --- |
| What is `$C$` in Barlow Twins? | The **cross-correlation matrix** between the embeddings of two augmented views, computed across the batch. |
| Along which dimension is each embedding feature normalised before computing `$C$`? | The **batch dimension** (z-score across the batch). |
| Why z-score-normalise embedding features along the batch before computing `$C$`? | So `$C$` is a cross-correlation (entries in `$[-1, 1]$`) rather than an unbounded cross-covariance, which gives the "push toward identity" target a well-defined meaning. |

Loss structure — list, then per-term forward and backward:

| Question | Answer |
| --- | --- |
| What are the two terms in the Barlow Twins loss? | **Invariance term** (diagonal → 1), **redundancy reduction term** (off-diagonal → 0). |
| What does the **invariance term** in the Barlow Twins loss do? | Pushes diagonal entries of `$C$` toward **1**. |
| What does the **redundancy reduction term** in the Barlow Twins loss do? | Pushes off-diagonal entries of `$C$` toward **0**. |
| Which term in the Barlow Twins loss pushes diagonal entries of `$C$` to 1? | The **invariance term**. |
| Which term in the Barlow Twins loss pushes off-diagonal entries of `$C$` to 0? | The **redundancy reduction term**. |

Cached insights — what each direction of pushing actually achieves at the representation level, plus the collapse argument:

| Question | Answer |
| --- | --- |
| What does pushing the diagonal of `$C$` to 1 encourage at the representation level? | Each embedding component becomes **invariant** under augmentation. |
| What does pushing the off-diagonal of `$C$` to 0 encourage at the representation level? | **Decorrelation** of embedding components, so each carries non-redundant information. |
| Why does Barlow Twins prevent representational collapse without negatives? | A constant or low-variance output would have **zero variance** and fail the off-diagonal term, so the loss penalises collapse **by construction**. |

Etymology:

| Question | Answer |
| --- | --- |
| What is the name "Barlow Twins" a reference to? | Neuroscientist **H. Barlow's 1961 hypothesis** that sensory systems should recode redundant inputs into a *factorial code* (statistically independent components). |

---

## Attribution

Principles, patterns, and the structure of the worked examples are adapted from Fernando Borretti's *Effective Spaced Repetition* ([borretti.me/article/effective-spaced-repetition](https://borretti.me/article/effective-spaced-repetition)), which itself builds on Piotr Woźniak's *Twenty rules of formulating knowledge*. Source-text passages in the worked examples have been re-summarised; the resulting Q&A pairs follow Borretti's pedagogical analysis closely, since the questions are the demonstration.
