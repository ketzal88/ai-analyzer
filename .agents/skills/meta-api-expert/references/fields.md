# Meta Insights Fields Reference

This document lists the most stable and commonly used fields (v17.0 - v19.0+) categorized by their function.

## 🎯 Delivery & Reach
- `impressions`
- `reach`
- `frequency`
- `unique_clicks`
- `unique_ctr`
- `estimated_ad_recallers`
- `estimated_ad_recall_rate`
- `quality_ranking`
- `engagement_rate_ranking`
- `conversion_rate_ranking`

## 💰 Cost & Spend
- `spend`
- `cpm`
- `cpc`
- `cpp`
- `cost_per_unique_click`
- `cost_per_inline_link_click`
- `cost_per_unique_inline_link_click`
- `cost_per_action_type`

## 🖱 Click Metrics
- `clicks`
- `inline_link_clicks`
- `outbound_clicks`
- `outbound_clicks_ctr`
- `inline_link_click_ctr`
- `ctr`
- `unique_outbound_clicks`
- `unique_inline_link_clicks`

## 📈 Engagement
- `actions`
- `action_values`
- `video_avg_time_watched_actions`
- `video_play_actions`
- `video_p25_watched_actions`
- `video_p50_watched_actions`
- `video_p75_watched_actions`
- `video_p95_watched_actions`
- `video_p100_watched_actions`
- `video_30_sec_watched_actions`
- `post_engagement`
- `page_engagement`
- `post_reactions`
- `post_comments`
- `post_shares`

## 🛒 Conversion / Commerce
- `conversions`
- `conversion_values`
- `website_purchase_roas`
- `purchase_roas`
- `website_ctr`
- `website_clicks`
- `website_purchase`
- `website_leads`
- `website_add_to_cart`
- `website_initiate_checkout`
- `website_view_content`
- `website_complete_registration`
- `cost_per_conversion`
- `cost_per_unique_action_type`

## 📱 Attribution / Window-sensitive
- `attributed_conversions`
- `attributed_conversion_values`
- `conversion_rate`
- `conversion_value`
- `roas`
- `cost_per_result`
- `results`

## 🧠 Derived Metrics (Calculated)
Note: These are NOT API fields but should be calculated from standard fields.
- `hook_rate` = `video_3s_views` / `impressions`
- `retention_rate` = `video_p50` / `video_3s_views`
- `fitr` = `conversions` / `clicks`
- `cpa` = `spend` / `conversions`
- `roas` = `conversion_value` / `spend`

## ⚠️ Forbidden / Non-Existent Fields (Common Errors)
Do NOT request these:
- `inline_video_view_2s` ❌
- `video_2s_watched` ❌
- `website_roas` ❌ (Use `website_purchase_roas`)
- `leads` ❌ (Contained within `actions`)
