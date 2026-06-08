# Browser Console Messages

The following console messages were captured during E2E crawling of the dashboard:

```
[WARNING] The width(-1) and height(-1) of chart should be greater than 0,
       please check the style of container, or the props width(100%) and height(100%),
       or add a minWidth(0) or minHeight(undefined) or use aspect(undefined) to control the
       height and width.
```
*   **Source**: Recharts components on dashboard or insights views.
*   **Resolution**: Ensure parent wrapping containers of ResponsiveContainer have explicit width/height dimensions.
