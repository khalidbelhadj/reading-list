import SwiftUI

/// Which sidebar row is hovered and where it is, for the one preview card
/// that glides between rows: a short delay before the first card, and a
/// grace period on leaving so moving between rows never blinks.
@MainActor
@Observable
final class HoverPreviewState {
    private(set) var itemId: String?
    /// The hovered row, in the window's coordinate space.
    private(set) var anchor: CGRect = .zero
    private(set) var isOpen = false

    private var openTask: Task<Void, Never>?
    private var closeTask: Task<Void, Never>?

    func enter(_ id: String, frame: CGRect) {
        cancelTimers()
        itemId = id
        anchor = frame
        guard !isOpen else { return }
        openTask = Task { [weak self] in
            try? await Task.sleep(for: .milliseconds(200))
            guard !Task.isCancelled, let self else { return }
            isOpen = true
        }
    }

    /// The hovered row moved under the pointer (the sidebar scrolled).
    func move(_ id: String, frame: CGRect) {
        guard itemId == id else { return }
        anchor = frame
    }

    func leave(_ id: String) {
        guard itemId == id else { return }
        cancelTimers()
        closeTask = Task { [weak self] in
            try? await Task.sleep(for: .milliseconds(120))
            guard !Task.isCancelled, let self else { return }
            isOpen = false
            itemId = nil
        }
    }

    private func cancelTimers() {
        openTask?.cancel()
        closeTask?.cancel()
        openTask = nil
        closeTask = nil
    }
}

extension View {
    /// Shows the item's preview card beside this row while it is hovered.
    func hoverPreview(_ itemId: String) -> some View {
        modifier(HoverPreviewAnchor(itemId: itemId))
    }
}

private struct HoverPreviewAnchor: ViewModifier {
    let itemId: String
    @Environment(HoverPreviewState.self) private var hover
    @State private var frame: CGRect = .zero

    func body(content: Content) -> some View {
        content
            .onGeometryChange(for: CGRect.self) {
                $0.frame(in: .global)
            } action: { next in
                frame = next
                hover.move(itemId, frame: next)
            }
            .onHover { inside in
                if inside {
                    hover.enter(itemId, frame: frame)
                } else {
                    hover.leave(itemId)
                }
            }
    }
}

/// The one preview card, laid over the whole shell so it can sit beside
/// the sidebar: it follows the hovered row and stays inside the window.
struct HoverPreviewCard: View {
    @Environment(HoverPreviewState.self) private var hover
    @Environment(ItemStore.self) private var store
    @Environment(ItemPreviews.self) private var previews
    @State private var size: CGSize = .zero

    private let margin: CGFloat = 8
    private let glide = Animation.timingCurve(0.22, 1, 0.36, 1, duration: 0.18)

    var body: some View {
        GeometryReader { geometry in
            let bounds = geometry.frame(in: .global)
            if hover.isOpen, let id = hover.itemId, let item = store.item(id) {
                let x = min(hover.anchor.maxX + margin, bounds.maxX - size.width - margin) - bounds.minX
                let y =
                    min(max(hover.anchor.minY, bounds.minY + margin), bounds.maxY - size.height - margin) - bounds.minY
                HoverCard(width: 400) {
                    ItemPreview(
                        title: item.title, url: item.url, createdAt: item.createdAt,
                        previewImageURL: previews.imageURL(for: id)
                    )
                }
                .onGeometryChange(for: CGSize.self) {
                    $0.size
                } action: {
                    size = $0
                }
                .offset(x: x, y: y)
                .transition(.opacity.combined(with: .scale(scale: 0.98)))
                .task(id: id) { previews.ensure(item) }
            }
        }
        .animation(glide, value: hover.anchor)
        .animation(glide, value: hover.isOpen)
        .allowsHitTesting(false)
    }
}
