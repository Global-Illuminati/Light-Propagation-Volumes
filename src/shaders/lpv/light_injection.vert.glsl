#version 300 es
precision highp float;

layout(location = 0) in vec2 a_point_position;

uniform int u_texture_size;
uniform int u_rsm_size;

uniform vec3 u_light_direction;

uniform sampler2D u_rsm_flux;
uniform sampler2D u_rsm_world_positions;
uniform sampler2D u_rsm_world_normals;

#include <lpv_common.glsl>

struct RSMTexel 
{
	vec3 world_position;
	vec3 world_normal;
	vec4 flux;
};

out RSMTexel v_rsm_texel;
flat out ivec3 v_grid_cell;

RSMTexel getRSMTexel(ivec2 texCoord) 
{
	RSMTexel texel;
	texel.world_normal = texelFetch(u_rsm_world_normals, texCoord, 0).xyz;

	//displace the position by half a normal
	texel.world_position = texelFetch(u_rsm_world_positions, texCoord, 0).xyz + 0.5 * texel.world_normal;
	texel.flux = texelFetch(u_rsm_flux, texCoord, 0);
	return texel;
}

//calculate luminance given a color
float luminance(const in vec3 color) {
	return color.r * 0.299 + color.g * 0.587 + color.b * 0.114;
}

//get luminance from texel
float getTexelLuminance(const in RSMTexel texel)
{
	return luminance(texel.flux.rgb) * max(0.0, dot(texel.world_normal, -u_light_direction));
}

//get ndc texture coordinates from gridcell
vec2 getRenderingTexCoords(ivec3 gridCell)
{
	float f_texture_size = float(u_texture_size);
	//displace int coordinates with 0.5
	vec2 texCoords = vec2((gridCell.x % u_texture_size) + u_texture_size * gridCell.z, gridCell.y) + vec2(0.5);
	//get ndc coordinates
	vec2 ndc = vec2((2.0 * texCoords.x) / (f_texture_size * f_texture_size), (2.0 * texCoords.y) / f_texture_size) - vec2(1.0);
	return ndc;
}

//TODO: look into downsampling in the shader
RSMTexel getDownSampledTexel()
{
	const int downSamplingFactor = 4;
	int newRSMSize = u_rsm_size / downSamplingFactor;
	ivec2 rsmTexCoords = ivec2(gl_VertexID % u_rsm_size, gl_VertexID / u_rsm_size);

	ivec3 brightestCell = ivec3(0.0);
	float maxLuminance = 0.0;
	{
		for(int i = 0; i < downSamplingFactor; i++)
		{
			for(int j = 0; j < downSamplingFactor; j++)
			{
				//fullsize texcoords
				ivec2 texCoords = rsmTexCoords * downSamplingFactor + ivec2(i, j);
				RSMTexel rsmTexel = getRSMTexel(texCoords);
				float luminance = getTexelLuminance(rsmTexel);
				if(luminance > maxLuminance)
				{
					brightestCell = getGridCelli(rsmTexel.world_position, u_texture_size);
					maxLuminance = luminance;
				}
			}
		}
	}

	RSMTexel result;

	int nSamples = 0;
	for(int i = 0; i < downSamplingFactor; i++)
	{
		for(int j = 0; j < downSamplingFactor; j++)
		{
			ivec2 texCoords = rsmTexCoords * downSamplingFactor + ivec2(i, j);
			RSMTexel rsmTexel = getRSMTexel(texCoords);
			ivec3 texelCell = getGridCelli(rsmTexel.world_position, u_texture_size);
			vec3 deltaCell = vec3(texelCell - brightestCell);
			if(dot(deltaCell, deltaCell) < 3.0)
			{
				result.flux += rsmTexel.flux;
				result.world_position += rsmTexel.world_position;
				result.world_normal += rsmTexel.world_normal;
				nSamples++;
			}
		}
	}

	if(nSamples > 0)
	{
		result.flux /= float(nSamples);
		result.world_position /= float(nSamples);
		result.world_normal /= float(nSamples);
	}
	return result;
}

void main()
{
	ivec2 rsmTexCoords = ivec2(gl_VertexID % u_rsm_size, gl_VertexID / u_rsm_size);
	v_rsm_texel = getRSMTexel(rsmTexCoords);
	v_grid_cell = getGridCelli(v_rsm_texel.world_position, u_texture_size);

	vec2 tex_coord = getRenderingTexCoords(v_grid_cell);

	gl_PointSize = 4.0;
	//gl_Position = transformations * vec4(v_rsm_texel.world_position, 1.0);
	gl_Position = vec4(tex_coord, 0.0, 1.0);
	//gl_Position = vec4(v_grid_cell, 1.0);
}
