#version 300 es
precision highp float;

#define PI 3.1415926f

#include <lpv_common.glsl>

layout(location = 0) out vec4 o_red_color;
layout(location = 1) out vec4 o_green_color;
layout(location = 2) out vec4 o_blue_color;

struct RSMTexel {
	vec3 world_position;
	vec3 world_normal;
	vec4 flux;
};

in RSMTexel v_rsm_texel;

//returns SH coefficients of this function rotated towards given direction
vec4 SHRotate(const vec3 dir, const vec2 ZHCoeffs)
{
	vec2 theta = normalize(dir.xy);

	vec2 phi;
	phi.x = sqrt(1.0 - dir.z * dir.z);
	phi.y = dir.z;

	vec4 result;
	result.x = ZHCoeffs.x;
	result.y = ZHCoeffs.y * phi.x * theta.x;
	result.z = -ZHCoeffs.y * phi.y;
	result.w = ZHCoeffs.y * phi.x * theta.x;
	return result;
}

//returns SH coefficients of hemispherical cosine lobe rotated towards given direction
vec4 SHProjectCone(const vec3 dir)
{
	const vec2 ZHCoeffs = vec2(0.25, 0.5);
	return SHRotate(dir, ZHCoeffs);
}

//#define DEBUG_RENDER

void main()
{
    //float surfelWeight = 0.015f; // nbr of cells / texels
	vec4 SH_coeffs = (evalCosineLobeToDir(v_rsm_texel.world_normal) / PI);// * surfelWeight;
	vec4 shR = SH_coeffs * v_rsm_texel.flux.r;
	vec4 shG = SH_coeffs * v_rsm_texel.flux.g;
	vec4 shB = SH_coeffs * v_rsm_texel.flux.b;

#ifdef DEBUG_RENDER
	o_red_color = vec4(normalize(shR.xyz),1.0);
	o_green_color = vec4(normalize(shG.xyz),1.0);
	o_blue_color = vec4(normalize(shB.xyz),1.0);
#else
	o_red_color = shR;
	o_green_color = shG;
	o_blue_color = shB;
#endif
}
