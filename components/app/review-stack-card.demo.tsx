import { type Demo } from "@/components/system/demo";

import { ReviewStackCard } from "./review-stack-card";

export const demo: Demo = {
  title: "Review stack card",
  description:
    "A compiled stack before it starts: title, the agent's summary, the card split, and the sources with their card counts. A source with no cards is listed muted so the gap shows.",
  render: () => (
    <div className="flex max-w-xl flex-col gap-4">
      <ReviewStackCard
        title="Self-supervised learning"
        summary="Redundancy-reduction methods (Barlow Twins, VICReg) and how they avoid representational collapse."
        stats={{ cards: 18, due: 5, fresh: 10, cram: 3 }}
        sources={[
          {
            id: "1",
            title:
              "Barlow Twins: Self-Supervised Learning via Redundancy Reduction",
            url: "https://arxiv.org/abs/2103.03230",
            cardCount: 8,
          },
          {
            id: "2",
            title:
              "VICReg: Variance-Invariance-Covariance Regularization for Self-Supervised Learning",
            url: "https://arxiv.org/abs/2105.04906",
            cardCount: 10,
          },
          {
            id: "3",
            title: "A Cookbook of Self-Supervised Learning",
            url: "https://arxiv.org/abs/2304.12210",
            cardCount: 0,
          },
        ]}
        onOpenSource={() => {}}
        onStart={() => {}}
      />
      <ReviewStackCard
        title="Distributed systems"
        summary="Plenty of reading on the topic, but no cards written yet."
        stats={{ cards: 0, due: 0, fresh: 0, cram: 0 }}
        sources={[
          {
            id: "4",
            title:
              "FoundationDB: A Distributed Unbundled Transactional KeyValue Store",
            url: "https://www.foundationdb.org/files/fdb-paper.pdf",
            cardCount: 0,
          },
          {
            id: "5",
            title: "The Snowflake Elastic Data Warehouse",
            url: "https://dl.acm.org/doi/10.1145/2882903.2903741",
            cardCount: 0,
          },
        ]}
      />
    </div>
  ),
};
