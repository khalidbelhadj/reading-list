import SwiftUI

/// A frost sidebar docked to the left, resizable by dragging its right
/// edge. Width is clamped to [minWidth, maxWidth]; a double-click on the
/// handle resets it. Over the desktop this is Liquid Glass.
struct KitSidebar<Content: View>: View {
    var defaultWidth: CGFloat = 224
    var minWidth: CGFloat = 180
    var maxWidth: CGFloat = 420
    @ViewBuilder let content: () -> Content
    @State private var width: CGFloat
    @State private var dragStartWidth: CGFloat?
    @State private var handleHovered = false

    init(
        defaultWidth: CGFloat = 224, minWidth: CGFloat = 180, maxWidth: CGFloat = 420,
        @ViewBuilder content: @escaping () -> Content
    ) {
        self.defaultWidth = defaultWidth
        self.minWidth = minWidth
        self.maxWidth = maxWidth
        self.content = content
        _width = State(initialValue: defaultWidth)
    }

    private var dragging: Bool { dragStartWidth != nil }

    var body: some View {
        content()
            .frame(width: width)
            .frame(maxHeight: .infinity)
            .glassEffect(.regular.tint(Theme.background.opacity(0.28)), in: Rectangle())
            .overlay(alignment: .trailing) {
                // A 6pt hit area straddling the edge, with a hairline that
                // shows while hovered or dragging.
                Rectangle()
                    .fill(.clear)
                    .frame(width: 6)
                    .overlay(alignment: .center) {
                        Rectangle()
                            .fill(Theme.fg(dragging ? 0.25 : 0.15))
                            .frame(width: 1)
                            .opacity(dragging || handleHovered ? 1 : 0)
                    }
                    .contentShape(Rectangle())
                    .offset(x: 3)
                    .pointerStyle(.columnResize)
                    .onHover { handleHovered = $0 }
                    .gesture(
                        DragGesture(minimumDistance: 1)
                            .onChanged { drag in
                                let start = dragStartWidth ?? width
                                dragStartWidth = start
                                width = min(max(start + drag.translation.width, minWidth), maxWidth)
                            }
                            .onEnded { _ in dragStartWidth = nil }
                    )
                    .onTapGesture(count: 2) { width = defaultWidth }
            }
            .animation(dragging ? nil : Theme.layoutMotion, value: width)
    }
}

// MARK: - Demo

extension Demo {
    static let sidebar = Demo(
        "Sidebar",
        description:
            "A frost sidebar resizable from its right edge: drag to resize within bounds, double-click the edge to reset. Over the desktop it is Liquid Glass."
    ) {
        HStack(spacing: 0) {
            KitSidebar(defaultWidth: 200, minWidth: 140, maxWidth: 320) {
                Text("Drag the right edge")
                    .textStyle(.small)
                    .foregroundStyle(Theme.mutedForeground)
                    .padding(12)
                    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
            }
            Spacer(minLength: 0)
        }
        .frame(height: 288)
        .background(DemoBackdrop())
        .clipShape(Theme.surfaceShape)
    }
}
