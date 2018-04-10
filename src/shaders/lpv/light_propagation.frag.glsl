#version 300 es
precision highp float;

#define PI 3.1415926f

#define SH_C0 0.282094791f // 1 / 2sqrt(pi)
#define SH_C1 0.488602512f // sqrt(3/pi) / 2

/*Cosine lobe coeff*/
#define SH_cosLobe_C0 0.886226925f // sqrt(pi)/2
#define SH_cosLobe_C1 1.02332671f // sqrt(pi/3)

#define CELLSIZE 1.0

uniform highp int u_grid_size;

uniform sampler2D u_red_contribution;
uniform sampler2D u_green_contribution;
uniform sampler2D u_blue_contribution;

flat in ivec2 v_cell_index;

layout(location = 0) out vec4 o_red_color;
layout(location = 1) out vec4 o_green_color;
layout(location = 2) out vec4 o_blue_color;

//3d directions needed for sh calculations
const vec3 directions[6] = vec3[] (
	//x
	vec3(1.0,0.0,0.0),
	vec3(-1.0,0.0,0.0),
    //y
	vec3(0.0,1.0,0.0),
	vec3(0.0,-1.0,0.0),
    //z
    vec3(0.0,0.0,1.0),
	vec3(0.0,0.0,-1.0)
);

//6 neighbours in our flattened representation of the 3d grid
//later defined during runtime
ivec2 neighbours[6];

// Faces in cube
const ivec2 sideFaces[4] = ivec2[](
    ivec2(1, 0),   // right
    ivec2(0, 1),   // up
    ivec2(-1, 0),  // left
    ivec2(0, -1)   // down
);

vec4 evalCosineLobeToDir(vec3 dir)
{
	return vec4(SH_cosLobe_C0, -SH_cosLobe_C1 * dir.y, SH_cosLobe_C1 * dir.z, -SH_cosLobe_C1 * dir.x);
}

// Get SH coeficients out of direction
vec4 dirToSH(vec3 dir)
{
    return vec4(SH_C0, -SH_C1 * dir.y, SH_C1 * dir.z, -SH_C1 * dir.x);
}

vec3 getEvalSideDirection(int index, vec3 orientation)
{
    const float smallComponent = 0.4472135; // 1 / sqrt(5)
    const float bigComponent = 0.894427; // 2 / sqrt(5)

    vec2 current_side = vec2(sideFaces[index]);
    return orientation * vec3(current_side.x * smallComponent, current_side.y * smallComponent, bigComponent);
}

vec3 getReprojSideDirection(int index, vec3 orientation)
{
    ivec2 current_side = sideFaces[index];
    return orientation * vec3(current_side.x, current_side.y, 0);
}

vec4 new_red_contribution = vec4(0.0);
vec4 new_green_contribution = vec4(0.0);
vec4 new_blue_contribution = vec4(0.0);

void propagate() {
    for(int neighbour = 0; neighbour < neighbours.length(); neighbour++)
    {
        vec4 red_contribution_neighbour = vec4(0.0);
        vec4 green_contribution_neighbour = vec4(0.0);
        vec4 blue_contribution_neighbour = vec4(0.0);

        ivec2 offset_flattened = neighbours[neighbour];
        vec3 offset = directions[neighbour];

        ivec2 neighbour_index = v_cell_index - offset_flattened;

        red_contribution_neighbour = texelFetch(u_red_contribution, neighbour_index, 0);
        green_contribution_neighbour = texelFetch(u_green_contribution, neighbour_index, 0);
        blue_contribution_neighbour = texelFetch(u_blue_contribution, neighbour_index, 0);

        vec4 offset_cosine_lobe = evalCosineLobeToDir(offset);
        vec4 offset_spherical_harmonic = dirToSH(offset);

        new_red_contribution += max(0.0, dot( red_contribution_neighbour, offset_spherical_harmonic)) * offset_cosine_lobe;
        new_green_contribution += max(0.0, dot( green_contribution_neighbour, offset_spherical_harmonic)) * offset_cosine_lobe;
        new_blue_contribution += max(0.0, dot( blue_contribution_neighbour, offset_spherical_harmonic)) * offset_cosine_lobe;

        for(int face = 0; face < 4; face++)
        {
            vec3 eval_direction = getEvalSideDirection(face, offset);

            vec3 reproj_direction = getReprojSideDirection(face, offset);

            vec4 reproj_direction_cosine_lobe = evalCosineLobeToDir( reproj_direction );
			vec4 eval_direction_spherical_harmonic = dirToSH( eval_direction );
			
		    new_red_contribution += max(0.0, dot( red_contribution_neighbour, eval_direction_spherical_harmonic )) * reproj_direction_cosine_lobe;
			new_green_contribution += max(0.0, dot( green_contribution_neighbour, eval_direction_spherical_harmonic )) * reproj_direction_cosine_lobe;
			new_blue_contribution += max(0.0, dot( blue_contribution_neighbour, eval_direction_spherical_harmonic )) * reproj_direction_cosine_lobe;
        }
    }
}


void main()
{
    propagate();

    o_red_color += new_red_contribution;
    o_green_color += new_green_contribution;
    o_blue_color += new_blue_contribution;
}