#ifndef COMMON_GLSL
#define COMMON_GLSL

float saturate(in float value) {
	return clamp(value, 0.0, 1.0);
}

float sample_shadow_map(in sampler2D shadow_map, in vec2 uv, in float comparison_depth, in float bias)
{
	float shadow_map_depth = texture(shadow_map, uv).r;
	return step(comparison_depth, shadow_map_depth + bias);
}

float sample_shadow_map_pcf(in sampler2D shadow_map, in vec2 uv, in float comparison_depth, vec2 texel_size, in float bias)
{
	float tx = texel_size.x;
	float ty = texel_size.y;

	float visibility = 0.0;

	//
	// TODO: Do we need a big 9x9 PCF? Maybe smaller is sufficient?
	//

	visibility += sample_shadow_map(shadow_map, uv + vec2(-tx, -ty), comparison_depth, bias);
	visibility += sample_shadow_map(shadow_map, uv + vec2(-tx,   0), comparison_depth, bias);
	visibility += sample_shadow_map(shadow_map, uv + vec2(-tx, +ty), comparison_depth, bias);
	visibility += sample_shadow_map(shadow_map, uv + vec2(  0, -ty), comparison_depth, bias);
	visibility += sample_shadow_map(shadow_map, uv + vec2(  0,   0), comparison_depth, bias);
	visibility += sample_shadow_map(shadow_map, uv + vec2(  0, +ty), comparison_depth, bias);
	visibility += sample_shadow_map(shadow_map, uv + vec2(+tx, -ty), comparison_depth, bias);
	visibility += sample_shadow_map(shadow_map, uv + vec2(+tx,   0), comparison_depth, bias);
	visibility += sample_shadow_map(shadow_map, uv + vec2(+tx, +ty), comparison_depth, bias);

	return visibility / 9.0;

}

#endif // COMMON_GLSL
