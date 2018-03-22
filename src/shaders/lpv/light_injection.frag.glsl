#version 300 es
precision highp float;

#define PI 3.1415926f

#define SH_C0 0.282094791f // 1 / 2sqrt(pi)
#define SH_C1 0.488602512f // sqrt(3/pi) / 2

/*Cosine lobe coeff*/
#define SH_cosLobe_C0 0.886226925f // sqrt(pi)/2 
#define SH_cosLobe_C1 1.02332671f // sqrt(pi/3)

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

vec4 evalCosineLobeToDir(vec3 dir) {
	dir = normalize(dir);
	//f00, f-11, f01, f11
	return vec4( SH_cosLobe_C0, -SH_cosLobe_C1 * dir.y, SH_cosLobe_C1 * dir.z, -SH_cosLobe_C1 * dir.x );
}

//#define DEBUG_RENDER

void main()
{
    float surfelWeight = 0.015f; // nbr of cells / texels
	vec4 SH_coeffs = (evalCosineLobeToDir(v_rsm_texel.world_normal) / PI) * surfelWeight;
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
