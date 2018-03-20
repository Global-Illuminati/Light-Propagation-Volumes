#version 300 es

#include <common.glsl>

layout(location = 0) in vec2 a_point_position;

uniform int u_texture_size;
uniform int u_rsm_size;

uniform sampler2D u_rsm_flux;
uniform sampler2D u_rsm_world_positions;
uniform sampler2D u_rsm_world_normals;

uniform mat4 u_world_from_local;
uniform mat4 u_view_from_world;
uniform mat4 u_projection_from_view;

#define v_min vec3(0.0)
#define CELLSIZE 4.0
#define GRIDSIZE 32.0

struct RSMTexel 
{
	vec3 world_position;
	vec3 world_normal;
	vec4 flux;
};

out RSMTexel v_rsm_texel;
flat out ivec3 v_grid_cell;

ivec3 getGridCell(vec3 pos, vec3 normal) 
{
	//displace by half a normal
	return ivec3((pos / CELLSIZE) + 0.5 * normal);
}

RSMTexel getRSMTexel(ivec2 texCoord) 
{
	RSMTexel texel;
	texel.world_normal = texelFetch(u_rsm_world_normals, texCoord, 0).xyz;
	texel.world_position = texelFetch(u_rsm_world_positions, texCoord, 0).xyz;
	texel.flux = texelFetch(u_rsm_flux, texCoord, 0);
	return texel;
}

//get ndc texture coordinates from gridcell
vec2 getRenderingTexCoords(ivec3 gridCell)
{
	float f_texture_size = float(u_texture_size);
	vec2 texCoords = vec2((gridCell.x % u_texture_size) + u_texture_size * gridCell.z, gridCell.y) + vec2(0.5);
	vec2 ndc = vec2(2.0 * texCoords.x / f_texture_size * f_texture_size, 2.0 * texCoords.y / f_texture_size) - 1.0;
	return ndc;
}

out vec2 t_coord;

//TODO:figure out of to get the correct texture layer and render to the 3d texture correctly
void main()
{
	ivec2 rsmTexCoords = ivec2(gl_VertexID % u_rsm_size, gl_VertexID / u_rsm_size);

	v_rsm_texel = getRSMTexel(rsmTexCoords);
	v_grid_cell = getGridCell(v_rsm_texel.world_position,v_rsm_texel.world_normal);

	mat4 transformations = u_projection_from_view * u_view_from_world * u_world_from_local;
	vec4 worldGridPos = transformations * vec4(v_grid_cell, 1.0);

	vec2 tex_coord = getRenderingTexCoords(v_grid_cell);
	t_coord = tex_coord;

	gl_PointSize = 4.0;
	//gl_Position = transformations * vec4(v_rsm_texel.world_position, 1.0);
	gl_Position = vec4(tex_coord, 0.0, 1.0);
	//gl_Position = vec4(v_grid_cell, 1.0);
}
